-- =====================================================================
-- 0002: two account types, people-following, org onboarding, health requests
-- Run AFTER 0001. Safe on a database that already has users.
-- =====================================================================

-- ---------- 1. Two roles only: volunteer | organization ----------------
update public.profiles
   set role = case when role = 'ngo' then 'organization' else 'volunteer' end;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('volunteer', 'organization'));

-- A person's account type is chosen once and then locked.
create or replace function public.guard_profile_role() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role'
     and old.onboarded and new.role is distinct from old.role then
    raise exception 'account type cannot be changed after onboarding';
  end if;
  return new;
end $$;
drop trigger if exists profile_role_guard on public.profiles;
create trigger profile_role_guard before update on public.profiles
for each row execute function public.guard_profile_role();

-- Volunteer onboarding / profile edit: role is forced to 'volunteer', never taken from the client.
create or replace function public.complete_onboarding(
  p_role text, p_interests text[],
  p_full_name text, p_location text, p_skills text[],
  p_blood_group blood_group, p_donor boolean,
  p_lat double precision default null, p_lng double precision default null
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_blood_group is null then raise exception 'blood group is required'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'organization') then
    raise exception 'organization accounts do not use volunteer onboarding';
  end if;

  update public.profiles
     set role      = 'volunteer',
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

-- Organization onboarding: creates the organization and makes this account *be* it.
create or replace function public.complete_org_onboarding(
  p_name text, p_type org_type, p_location text, p_about text, p_interests text[],
  p_lat double precision default null, p_lng double precision default null
) returns text language plpgsql security invoker set search_path = public as $$
declare base text; v_slug text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and onboarded) then
    raise exception 'already onboarded';
  end if;
  if char_length(trim(p_name)) < 2 then raise exception 'organization name is required'; end if;

  base := trim(both '-' from lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')));
  if base = '' then base := 'org'; end if;
  v_slug := base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (slug, name, type, location, about, lat, lng, owner_id)
  values (v_slug, trim(p_name), p_type, trim(p_location), nullif(trim(p_about), ''), p_lat, p_lng, auth.uid());

  update public.profiles
     set role = 'organization', full_name = trim(p_name), location = trim(p_location),
         lat = p_lat, lng = p_lng, interests = coalesce(p_interests, '{}'),
         username = v_slug || substr(replace(auth.uid()::text, '-', ''), 1, 4),
         onboarded = true
   where id = auth.uid();
  return v_slug;
end $$;

-- ---------- 2. Following people (Facebook-style) ------------------------
create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.user_follows enable row level security;
create policy "user follows readable" on public.user_follows for select to authenticated using (true);
create policy "user follow"   on public.user_follows for insert to authenticated with check (follower_id = auth.uid());
create policy "user unfollow" on public.user_follows for delete to authenticated using (follower_id = auth.uid());

-- ---------- 3. Leaderboard is for volunteers only ----------------------
create or replace function public.leaderboard(p_days int default 7, p_below int default 0)
returns table (rank int, user_id uuid, full_name text, points int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with weekly as (
    select p.id, p.full_name,
           coalesce(sum(d.points) filter (where d.status = 'verified'
                                            and d.verified_at >= now() - make_interval(days => p_days)), 0)::int as pts
      from public.profiles p
      left join public.good_deeds d on d.user_id = p.id
     where p.onboarded and p.role = 'volunteer'
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
