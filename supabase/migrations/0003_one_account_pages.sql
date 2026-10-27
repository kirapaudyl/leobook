-- =====================================================================
-- 0003: Facebook-style model. ONE account type (a person). Anyone can create and manage
-- pages / groups (organizations) from their main account. Also purges the old Portland demo data.
-- Run AFTER 0001 and 0002.
-- =====================================================================

-- ---------- 1. One account type ---------------------------------------
drop trigger if exists profile_role_guard on public.profiles;
drop function if exists public.guard_profile_role();
update public.profiles set role = 'volunteer';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('volunteer', 'organization'));

-- Previous organization-account onboarding is gone: pages are created from a normal account.
drop function if exists public.complete_org_onboarding(text, org_type, text, text, text[], double precision, double precision);
drop function if exists public.complete_onboarding(text, text[], text, text, text[], blood_group, boolean, double precision, double precision);

-- Onboarding is the same for everybody: name, place, skills, blood group.
create or replace function public.complete_onboarding(
  p_interests text[], p_full_name text, p_location text, p_skills text[],
  p_blood_group blood_group, p_donor boolean,
  p_lat double precision default null, p_lng double precision default null
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_blood_group is null then raise exception 'blood group is required'; end if;

  update public.profiles
     set interests = coalesce(p_interests, '{}'),
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

-- ---------- 2. Create a page or group from your main account -----------
create or replace function public.create_page(
  p_name text, p_type org_type, p_location text, p_about text,
  p_lat double precision default null, p_lng double precision default null
) returns text language plpgsql security invoker set search_path = public as $$
declare base text; v_slug text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'a name is required'; end if;
  if (select count(*) from public.organizations where owner_id = auth.uid()) >= 10 then
    raise exception 'you can manage up to 10 pages and groups';
  end if;

  base := trim(both '-' from lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')));
  if base = '' then base := 'page'; end if;
  v_slug := base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  -- the owner becomes an approved owner-member automatically (trigger org_owner_member)
  insert into public.organizations (slug, name, type, location, about, lat, lng, owner_id)
  values (v_slug, trim(p_name), p_type, nullif(trim(p_location), ''), nullif(trim(p_about), ''), p_lat, p_lng, auth.uid());
  return v_slug;
end $$;

-- ---------- 3. Leaderboard = people who have a civic profile ------------
create or replace function public.leaderboard(p_days int default 7, p_below int default 0)
returns table (rank int, user_id uuid, full_name text, points int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with weekly as (
    select p.id, p.full_name,
           coalesce(sum(d.points) filter (where d.status = 'verified'
                                            and d.verified_at >= now() - make_interval(days => p_days)), 0)::int as pts
      from public.profiles p
      join public.profile_health h on h.user_id = p.id
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

-- ---------- 4. Remove the old Portland demo data -----------------------
-- (events, gallery, emergency requests cascade; seeded posts keep their text so we delete them explicitly)
delete from public.posts where body like 'A small garden can grow%' or body like 'Just joined LeoBook%';
delete from public.organizations where slug in ('green-circle-foundation', 'st-joseph-medical-center');

-- ---------- 5. "Nearby ways to help" must actually be nearby -----------
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
     -- only events within 150 km of the member (events or members without coordinates are kept)
     and (public.distance_km(me.lat, me.lng, e.lat, e.lng) is null
          or public.distance_km(me.lat, me.lng, e.lat, e.lng) <= 150)
   order by public.distance_km(me.lat, me.lng, e.lat, e.lng) asc nulls last,
            cardinality(array(select unnest(e.skills_wanted) intersect select unnest(me.skills))) desc,
            e.starts_at
   limit p_limit;
$$;
