-- Who may send blood alerts: VERIFIED organisations that are either health organisations
-- or "big" (500+ followers). Change the threshold here and nowhere else.
create or replace function public.can_send_blood_alerts(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.verified and (o.type = 'health' or o.follower_count >= 500)
       from public.organizations o where o.id = p_org),
    false);
$$;
grant execute on function public.can_send_blood_alerts(uuid) to authenticated;

-- Extra request details shown to matched donors
alter table public.emergency_requests add column if not exists contact_phone text;

-- Input limits enforced by the database (NOT VALID = applies to new rows only)
alter table public.emergency_requests
  add constraint emergency_units_max    check (units_needed <= 50) not valid,
  add constraint emergency_hospital_len check (char_length(hospital) between 2 and 120) not valid,
  add constraint emergency_note_len     check (note is null or char_length(note) <= 500) not valid,
  add constraint emergency_phone_fmt    check (contact_phone is null or contact_phone ~ '^[+0-9][0-9 ()-]{6,19}$') not valid;

-- Insert policy: org admin + eligible organisation
drop policy if exists "emergency create" on public.emergency_requests;
create policy "emergency create" on public.emergency_requests for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_org_admin(org_id)
    and public.can_send_blood_alerts(org_id)
  );

-- Matching engine: same logic as before, new eligibility rule
create or replace function public.match_emergency_donors() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_send_blood_alerts(new.org_id) then
    raise exception 'only verified health organisations or verified organisations with 500+ followers can send blood alerts';
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

-- Anti-spam: at most 3 alerts per organisation per 24 hours
create or replace function public.guard_emergency_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.emergency_requests
       where org_id = new.org_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'This organisation has reached the limit of 3 blood alerts per 24 hours';
  end if;
  return new;
end $$;
drop trigger if exists emergency_rate_guard on public.emergency_requests;
create trigger emergency_rate_guard before insert on public.emergency_requests
for each row execute function public.guard_emergency_rate();

-- Admins may only change the status of an alert (fulfil / cancel), never its blood group or location
revoke update on public.emergency_requests from authenticated;
grant  update (status) on public.emergency_requests to authenticated;
