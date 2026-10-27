-- =====================================================================
-- LeoBook MVP schema
-- Run in the Supabase SQL editor, or via `supabase db push`.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- enums ----------------------------------------------------
create type blood_group         as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
create type org_type            as enum ('ngo','collective','organizer','health');
create type member_role         as enum ('owner','admin','member');
create type member_status       as enum ('pending','approved');
create type deed_kind           as enum ('volunteer','blood_donation','invite','event','good_deed');
create type verification_status as enum ('pending','verified','rejected');
create type emergency_status    as enum ('active','fulfilled','expired','cancelled');
create type match_response      as enum ('accepted','declined');
create type event_kind          as enum ('event','workshop');

-- ---------- profiles (public) + health (private) -----------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  username    text unique,
  avatar_url  text,
  location    text,
  lat         double precision,
  lng         double precision,
  skills      text[] not null default '{}',
  role        text not null default 'volunteer' check (role in ('volunteer','ngo','public')),
  interests   text[] not null default '{}',
  headline    text,
  bio         text,
  identity_verified boolean not null default false,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Blood group is sensitive: it lives in its own table, readable only by its owner.
create table public.profile_health (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  blood_group      blood_group not null,
  is_blood_donor   boolean not null default false,
  last_donated_at  date
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Atomic onboarding: profile + health row in one call.
create or replace function public.complete_onboarding(
  p_role text, p_interests text[],
  p_full_name text, p_location text, p_skills text[],
  p_blood_group blood_group, p_donor boolean,
  p_lat double precision default null, p_lng double precision default null
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_blood_group is null then raise exception 'blood group is required'; end if;

  update public.profiles
     set role      = coalesce(p_role, role),
         interests = coalesce(p_interests, '{}'),
         full_name = trim(p_full_name),
         location  = trim(p_location),
         lat       = coalesce(p_lat, lat),
         lng       = coalesce(p_lng, lng),
         skills    = coalesce(p_skills, '{}'),
         username  = coalesce(username,
                       lower(regexp_replace(trim(p_full_name), '[^a-zA-Z0-9]+', '', 'g'))
                       || substr(replace(auth.uid()::text, '-', ''), 1, 4)),
         onboarded = true
   where id = auth.uid();

  insert into public.profile_health (user_id, blood_group, is_blood_donor)
  values (auth.uid(), p_blood_group, coalesce(p_donor, false))
  on conflict (user_id) do update
    set blood_group = excluded.blood_group, is_blood_donor = excluded.is_blood_donor;
end $$;

create or replace function public.guard_profile_flags() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role'
     and new.identity_verified is distinct from old.identity_verified then
    raise exception 'only LeoBook staff can change identity verification';
  end if;
  return new;
end $$;
create trigger profile_flags_guard before update on public.profiles
for each row execute function public.guard_profile_flags();

-- ---------- organisations --------------------------------------------
create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  type            org_type not null,
  verified        boolean not null default false,
  ai_verified     boolean not null default false,   -- shows 'AI-verified organization'
  tagline         text,
  about           text,
  location        text,
  banner_url      text,
  cover_credit    text,
  lat             double precision,
  lng             double precision,
  headline        text,
  ai_verified_since int,
  legal_status    text,
  location_note   text,
  impact          jsonb not null default '[]',   -- [{value:'42', label:'Gardens built'}]
  logo_url        text,
  owner_id        uuid not null references public.profiles(id),
  follower_count  int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.org_members (
  org_id      uuid references public.organizations(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  role        member_role not null default 'member',
  status      member_status not null default 'pending',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.org_followers (
  org_id      uuid references public.organizations(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
      and role in ('owner','admin') and status = 'approved'
  );
$$;

-- Only the service role may flip `verified`.
create or replace function public.guard_org_verified() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    if tg_op = 'INSERT' then new.verified := false; new.ai_verified := false;
    elsif new.verified is distinct from old.verified
       or new.ai_verified is distinct from old.ai_verified then
      raise exception 'only LeoBook staff can change verification';
    end if;
  end if;
  return new;
end $$;
create trigger org_verified_guard before insert or update on public.organizations
for each row execute function public.guard_org_verified();

-- Owner becomes an approved owner member automatically.
create or replace function public.org_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.org_members (org_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'approved') on conflict do nothing;
  return new;
end $$;
create trigger org_owner_member after insert on public.organizations
for each row execute function public.org_owner_membership();

-- ---------- events ---------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  title        text not null,
  description  text,
  kind         event_kind not null default 'event',
  starts_at    timestamptz not null,
  location     text,
  lat          double precision,
  lng          double precision,
  cause        text,
  format_label text,                      -- 'Hands-on workshop'
  points       int not null default 120,  -- civic points for taking part
  cover_url    text,
  skills_wanted text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table public.event_rsvps (
  event_id    uuid references public.events(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- posts, likes, comments, initiative joins -------------------
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  org_id         uuid references public.organizations(id) on delete set null,
  body           text not null check (char_length(body) between 1 and 5000),
  media          jsonb not null default '[]',      -- [{url, type: 'image'|'video'}]
  event_id       uuid references public.events(id) on delete set null,
  location_text  text,
  is_initiative  boolean not null default false,
  like_count     int not null default 0,
  comment_count  int not null default 0,
  join_count     int not null default 0,
  share_count    int not null default 0,
  created_at     timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_org_idx on public.posts (org_id, created_at desc);

create table public.likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.initiative_joins (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Generic counter maintenance: bump_counter(table, counter_column, fk_column)
create or replace function public.bump_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; delta int;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); delta := -1;
  else r := to_jsonb(new); delta := 1; end if;
  execute format('update public.%I set %I = greatest(0, %I + $1) where id = ($2)::uuid',
                 tg_argv[0], tg_argv[1], tg_argv[1])
  using delta, r->>tg_argv[2];
  return null;
end $$;

create trigger likes_count    after insert or delete on public.likes
  for each row execute function public.bump_counter('posts','like_count','post_id');
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_counter('posts','comment_count','post_id');
create trigger joins_count    after insert or delete on public.initiative_joins
  for each row execute function public.bump_counter('posts','join_count','post_id');
create trigger followers_count after insert or delete on public.org_followers
  for each row execute function public.bump_counter('organizations','follower_count','org_id');

-- ---------- impact: verified good deeds -------------------------------
create table public.good_deeds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  org_id       uuid references public.organizations(id) on delete set null,  -- verifying org
  event_id     uuid references public.events(id) on delete set null,
  kind         deed_kind not null,
  title        text,
  description  text,
  hours        numeric(5,2) check (hours is null or hours > 0),
  quantity     int not null default 1 check (quantity > 0),   -- e.g. people invited
  points       int not null default 0,                         -- set by trigger, not by clients
  status       verification_status not null default 'pending',
  verified_by  uuid references public.profiles(id),
  verified_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (kind <> 'volunteer' or hours is not null)
);

-- Point rules (mirror in src/lib/world.ts): 40/volunteer hour, 200 blood donation,
-- 40 per invite, event points for event participation, 100 for other good deeds.
create or replace function public.set_deed_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.points := case new.kind
    when 'volunteer'      then round(coalesce(new.hours, 0) * 40)::int
    when 'blood_donation' then 200
    when 'invite'         then 40 * new.quantity
    when 'event'          then coalesce((select points from public.events where id = new.event_id), 120)
    else 100 end;
  return new;
end $$;
create trigger deed_points before insert on public.good_deeds
for each row execute function public.set_deed_points();

create index good_deeds_user_idx on public.good_deeds (user_id, created_at desc);

create or replace function public.on_deed_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare org_row public.organizations;
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    if new.org_id is null then raise exception 'a verifying organisation is required'; end if;
    select * into org_row from public.organizations where id = new.org_id;
    if new.kind = 'blood_donation' and not (org_row.type = 'health' and org_row.verified) then
      raise exception 'blood donations can only be verified by a verified health organisation';
    end if;
    new.verified_by := auth.uid();
    new.verified_at := now();
    if new.kind = 'blood_donation' then
      update public.profile_health set last_donated_at = current_date where user_id = new.user_id;
    end if;
  end if;
  return new;
end $$;
create trigger deed_status_change before insert or update on public.good_deeds
for each row execute function public.on_deed_status_change();

-- Stage thresholds live in one place. Mirror them in src/lib/world.ts.
create or replace function public.world_stage(p int) returns text
language sql immutable as $$
  select case
    when p >= 1500 then 'thriving_world'
    when p >= 1000 then 'caretaker_barn'
    when p >= 500  then 'farm'
    when p >= 200  then 'small_plant'
    else 'seed' end;
$$;

create view public.user_world with (security_invoker = true) as
select
  p.id as user_id,
  coalesce(sum(d.points) filter (where d.status = 'verified'), 0)::int                       as points,
  coalesce(sum(d.hours)  filter (where d.status = 'verified' and d.kind = 'volunteer'), 0)   as volunteer_hours,
  (count(*) filter (where d.status = 'verified' and d.kind = 'blood_donation'))::int         as blood_donations,
  (count(*) filter (where d.status = 'verified' and d.kind <> 'blood_donation'))::int        as good_deeds,
  coalesce(sum(d.quantity) filter (where d.status = 'verified' and d.kind = 'invite'), 0)::int as invites,
  public.world_stage(coalesce(sum(d.points) filter (where d.status = 'verified'), 0)::int)   as stage
from public.profiles p
left join public.good_deeds d on d.user_id = p.id
group by p.id;

-- ---------- notifications ---------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify_deed_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    insert into public.notifications (user_id, kind, title, body, data)
    values (new.user_id, 'deed_verified', 'Your impact was verified',
            coalesce(new.title, new.kind::text), jsonb_build_object('deed_id', new.id, 'points', new.points));
  end if;
  return new;
end $$;
create trigger deed_verified_notify after insert or update on public.good_deeds
for each row execute function public.notify_deed_verified();

-- ---------- emergency blood requests ----------------------------------
create table public.emergency_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid not null references public.profiles(id),
  blood_group   blood_group not null,
  units_needed  int not null default 1 check (units_needed > 0),
  hospital      text not null,
  location      text,
  lat           double precision,
  lng           double precision,
  needed_by     timestamptz,
  note          text,
  status        emergency_status not null default 'active',
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);
create index emergency_active_idx on public.emergency_requests (status, expires_at);

create table public.emergency_matches (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.emergency_requests(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  response      match_response,
  notified_at   timestamptz not null default now(),
  responded_at  timestamptz,
  unique (request_id, user_id)
);
create index emergency_matches_user_idx on public.emergency_matches (user_id, notified_at desc);

-- Matching engine: runs inside the database the instant a request is created.
-- Exact blood-group match, opted-in donors only, 56-day donation cool-down.
create or replace function public.match_emergency_donors() returns trigger
language plpgsql security definer set search_path = public as $$
declare org_row public.organizations;
begin
  select * into org_row from public.organizations where id = new.org_id;
  if not (org_row.type = 'health' and org_row.verified) then
    raise exception 'only verified health organisations can raise emergency requests';
  end if;

  insert into public.emergency_matches (request_id, user_id)
  select new.id, h.user_id
    from public.profile_health h
    join public.profiles p on p.id = h.user_id
   where h.blood_group = new.blood_group
     and h.is_blood_donor
     and p.onboarded
     and h.user_id <> new.created_by
     and (h.last_donated_at is null or h.last_donated_at <= current_date - 56);

  insert into public.notifications (user_id, kind, title, body, data)
  select m.user_id, 'emergency_blood',
         new.blood_group::text || ' blood needed urgently',
         new.hospital || coalesce(' · ' || new.location, ''),
         jsonb_build_object('request_id', new.id)
    from public.emergency_matches m where m.request_id = new.id;

  return new;
end $$;
create trigger emergency_match after insert on public.emergency_requests
for each row execute function public.match_emergency_donors();

-- ---------- feed helpers -----------------------------------------------
-- Joining a campaign post also RSVPs the member to the tagged event.
create or replace function public.rsvp_on_campaign_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev uuid;
begin
  select event_id into ev from public.posts where id = new.post_id;
  if ev is not null then
    insert into public.event_rsvps (event_id, user_id) values (ev, new.user_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger campaign_join_rsvp after insert on public.initiative_joins
for each row execute function public.rsvp_on_campaign_join();

create or replace function public.share_post(p_post uuid) returns int
language sql volatile security definer set search_path = public as $$
  update public.posts set share_count = share_count + 1
   where id = p_post and auth.uid() is not null
  returning share_count;
$$;

create or replace function public.distance_km(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
returns float8 language sql immutable as $$
  select case when a_lat is null or a_lng is null or b_lat is null or b_lng is null then null
    else 2 * 6371 * asin(sqrt(
           power(sin(radians(b_lat - a_lat) / 2), 2) +
           cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))) end;
$$;

-- "Nearby ways to help": upcoming events ranked by skill overlap, then distance.
create or replace function public.matched_opportunities(p_limit int default 3)
returns table (id uuid, title text, cause text, cover_url text, starts_at timestamptz,
               location text, distance_km float8, attendee_count bigint, attendees text[])
language sql stable security invoker set search_path = public as $$
  with me as (select lat, lng, skills from public.profiles where id = auth.uid())
  select e.id, e.title, e.cause, e.cover_url, e.starts_at, e.location,
         public.distance_km(me.lat, me.lng, e.lat, e.lng),
         (select count(*) from public.event_rsvps r where r.event_id = e.id),
         (select coalesce(array_agg(a.full_name), '{}')
            from (select p.full_name from public.event_rsvps r
                  join public.profiles p on p.id = r.user_id
                  where r.event_id = e.id order by r.created_at limit 2) a)
    from public.events e, me
   where e.starts_at > now()
   order by cardinality(array(select unnest(e.skills_wanted) intersect select unnest(me.skills))) desc,
            public.distance_km(me.lat, me.lng, e.lat, e.lng) asc nulls last,
            e.starts_at
   limit p_limit;
$$;

-- Leaderboards (Home: 7 days / Rewards: 30 days). Top 2, the caller, and p_below rows after the caller.
create or replace function public.leaderboard(p_days int default 7, p_below int default 0)
returns table (rank int, user_id uuid, full_name text, points int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with weekly as (
    select p.id, p.full_name,
           coalesce(sum(d.points) filter (where d.status = 'verified'
                                            and d.verified_at >= now() - make_interval(days => p_days)), 0)::int as pts
      from public.profiles p
      left join public.good_deeds d on d.user_id = p.id
     where p.onboarded
     group by p.id
  ), ranked as (
    select id, full_name, pts, (row_number() over (order by pts desc, full_name))::int as rnk from weekly
  ), me as (select rnk from ranked where id = auth.uid())
  select rnk, id, full_name, pts, (id = auth.uid())
    from ranked
   where rnk <= 2 or id = auth.uid()
      or (rnk > (select rnk from me) and rnk <= (select rnk from me) + p_below)
   order by rnk;
$$;

-- ---------- hubs: gallery, member chat, join-request notifications ------
create table public.org_gallery (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  url        text not null,
  caption    text,
  position   int not null default 0
);
create table public.org_messages (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index org_messages_idx on public.org_messages (org_id, created_at desc);

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members
                 where org_id = p_org and user_id = auth.uid() and status = 'approved');
$$;

-- Nav badge on "Groups & Hubs": requests for admins, approvals for requesters.
create or replace function public.notify_hub_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare org_name text;
begin
  select name into org_name from public.organizations where id = new.org_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, kind, title, body, data)
    select m.user_id, 'hub', 'New request to join ' || org_name,
           (select full_name from public.profiles where id = new.user_id),
           jsonb_build_object('org_id', new.org_id)
      from public.org_members m
     where m.org_id = new.org_id and m.role in ('owner','admin') and m.status = 'approved';
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status = 'pending' then
    insert into public.notifications (user_id, kind, title, body, data)
    values (new.user_id, 'hub', 'You''re in: ' || org_name, 'Your request to join was approved.',
            jsonb_build_object('org_id', new.org_id));
  end if;
  return new;
end $$;
create trigger hub_membership_notify after insert or update on public.org_members
for each row execute function public.notify_hub_membership();

create or replace function public.org_admin_stats(p_org uuid)
returns table (upcoming_events int, hours_this_month numeric, active_volunteers int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.events where org_id = p_org and starts_at > now()),
    coalesce((select sum(hours) from public.good_deeds
               where org_id = p_org and status = 'verified' and kind = 'volunteer'
                 and verified_at >= date_trunc('month', now())), 0),
    (select count(distinct user_id)::int from public.good_deeds
      where org_id = p_org and status = 'verified' and verified_at >= now() - interval '30 days')
  where public.is_org_admin(p_org);
$$;

create or replace function public.my_streak()
returns table (current_weeks int, longest_weeks int)
language sql stable security invoker set search_path = public as $$
  with w as (
    select distinct date_trunc('week', verified_at)::date as wk
      from public.good_deeds
     where user_id = auth.uid() and status = 'verified' and verified_at is not null
  ), g as (
    select wk, wk - (row_number() over (order by wk))::int * 7 as grp from w
  ), runs as (
    select count(*)::int as len, max(wk) as last_wk from g group by grp
  )
  select coalesce(max(len) filter (where last_wk >= date_trunc('week', now())::date - 7), 0),
         coalesce(max(len), 0)
    from runs;
$$;

-- RLS helpers (security definer) so emergency_requests and emergency_matches
-- policies don't reference each other recursively.
create or replace function public.is_matched_donor(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.emergency_matches
                 where request_id = p_request and user_id = auth.uid());
$$;
create or replace function public.is_request_org_admin(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.emergency_requests r
                 where r.id = p_request and public.is_org_admin(r.org_id));
$$;

-- ---------- row level security ----------------------------------------
alter table public.profiles            enable row level security;
alter table public.profile_health      enable row level security;
alter table public.organizations       enable row level security;
alter table public.org_members         enable row level security;
alter table public.org_followers       enable row level security;
alter table public.events              enable row level security;
alter table public.event_rsvps         enable row level security;
alter table public.org_gallery         enable row level security;
alter table public.org_messages        enable row level security;
alter table public.posts               enable row level security;
alter table public.likes               enable row level security;
alter table public.comments            enable row level security;
alter table public.initiative_joins    enable row level security;
alter table public.good_deeds          enable row level security;
alter table public.notifications       enable row level security;
alter table public.emergency_requests  enable row level security;
alter table public.emergency_matches   enable row level security;

-- profiles
create policy "profiles readable"  on public.profiles for select to authenticated using (true);
create policy "profiles self-edit" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profile_health: owner only
create policy "health owner" on public.profile_health for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- organisations
create policy "orgs readable" on public.organizations for select to authenticated using (true);
create policy "orgs create"   on public.organizations for insert to authenticated with check (owner_id = auth.uid());
create policy "orgs admin edit" on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- membership ("Request to Join Hub")
create policy "members readable" on public.org_members for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_org_admin(org_id));
create policy "members request" on public.org_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member' and status = 'pending');
create policy "members admin update" on public.org_members for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "members leave" on public.org_members for delete to authenticated
  using (user_id = auth.uid() or public.is_org_admin(org_id));

-- followers
create policy "followers readable" on public.org_followers for select to authenticated using (true);
create policy "follow"   on public.org_followers for insert to authenticated with check (user_id = auth.uid());
create policy "unfollow" on public.org_followers for delete to authenticated using (user_id = auth.uid());

-- events
create policy "events readable" on public.events for select to authenticated using (true);
create policy "events admin write" on public.events for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "rsvps readable" on public.event_rsvps for select to authenticated using (true);
create policy "rsvp"   on public.event_rsvps for insert to authenticated with check (user_id = auth.uid());
create policy "unrsvp" on public.event_rsvps for delete to authenticated using (user_id = auth.uid());

-- gallery + member chat
create policy "gallery readable" on public.org_gallery for select to authenticated using (true);
create policy "gallery admin write" on public.org_gallery for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "chat read" on public.org_messages for select to authenticated using (public.is_org_member(org_id));
create policy "chat write" on public.org_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_org_member(org_id));

-- posts & social
create policy "posts readable" on public.posts for select to authenticated using (true);
create policy "posts create" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (org_id is null or public.is_org_admin(org_id)));
create policy "posts delete own" on public.posts for delete to authenticated using (author_id = auth.uid());
create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "like"   on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "unlike" on public.likes for delete to authenticated using (user_id = auth.uid());
create policy "comments readable" on public.comments for select to authenticated using (true);
create policy "comment" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "comment delete own" on public.comments for delete to authenticated using (author_id = auth.uid());
create policy "joins readable" on public.initiative_joins for select to authenticated using (true);
create policy "join"  on public.initiative_joins for insert to authenticated with check (user_id = auth.uid());
create policy "leave" on public.initiative_joins for delete to authenticated using (user_id = auth.uid());

-- good deeds: users submit as pending; only the verifying org's admins can change status
create policy "deeds read" on public.good_deeds for select to authenticated
  using (user_id = auth.uid() or (org_id is not null and public.is_org_admin(org_id)));
create policy "deeds submit" on public.good_deeds for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and verified_by is null);
create policy "deeds record by org" on public.good_deeds for insert to authenticated
  with check (status = 'verified' and org_id is not null and public.is_org_admin(org_id));
create policy "deeds verify" on public.good_deeds for update to authenticated
  using (org_id is not null and public.is_org_admin(org_id))
  with check (org_id is not null and public.is_org_admin(org_id));

-- notifications
create policy "notifs own read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifs own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- emergencies: only verified health orgs can create; donors see requests they matched
create policy "emergency create" on public.emergency_requests for insert to authenticated
  with check (
    created_by = auth.uid() and public.is_org_admin(org_id)
    and exists (select 1 from public.organizations o
                where o.id = org_id and o.type = 'health' and o.verified)
  );
create policy "emergency read" on public.emergency_requests for select to authenticated
  using (public.is_org_admin(org_id) or public.is_matched_donor(id));
create policy "emergency admin update" on public.emergency_requests for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "matches read" on public.emergency_matches for select to authenticated
  using (user_id = auth.uid() or public.is_request_org_admin(request_id));
create policy "matches respond" on public.emergency_matches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.emergency_matches from authenticated;
grant  update (response, responded_at) on public.emergency_matches to authenticated;

-- ---------- realtime ---------------------------------------------------
alter publication supabase_realtime add table
  public.emergency_matches, public.notifications, public.good_deeds, public.posts, public.org_messages;

-- ---------- storage ----------------------------------------------------
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true)
on conflict (id) do nothing;
create policy "post media read" on storage.objects for select using (bucket_id = 'post-media');
create policy "post media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
