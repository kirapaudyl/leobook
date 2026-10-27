-- Banner column (avatar_url already exists)
alter table public.profiles add column if not exists banner_url text;

-- Public-read bucket. Size and type limits are enforced by Supabase itself.
-- SVG is deliberately excluded because it can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Everyone can read; users can only write inside their own folder: profile-media/<user-id>/...
create policy "profile media read" on storage.objects for select
  using (bucket_id = 'profile-media');

create policy "profile media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile media update" on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
