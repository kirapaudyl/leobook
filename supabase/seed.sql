-- =====================================================================
-- Kathmandu Valley demo data. Places and coordinates are real; organization names, numbers and
-- people are FICTIONAL demo content. Replace before any public launch.
--
-- Run in the Supabase SQL editor AFTER you have signed up and finished onboarding once.
-- Safe to re-run: it resets the demo rows (including the old Portland demo).
-- =====================================================================
do $$
declare
  me     uuid := (select p.id from public.profiles p join public.profile_health h on h.user_id = p.id
                   where p.onboarded order by p.created_at limit 1);
  other  uuid;
  creator uuid;
  bg     blood_group;
  donor  boolean;
  base   timestamp := date_trunc('day', now() at time zone 'Asia/Kathmandu');
  grn uuid; lrn uuid; blood uuid; thamel uuid; boudha uuid; kirti uuid; bhak uuid;
  ev1 uuid; req uuid;
  img text := '/images/community-garden.jpg';
begin
  if me is null then raise exception 'Sign in and finish onboarding in the app first.'; end if;
  other   := (select id from public.profiles where onboarded and id <> me order by created_at limit 1);
  creator := coalesce(other, me);
  select blood_group, is_blood_donor into bg, donor from public.profile_health where user_id = me;

  -- reset demo rows (old Portland slugs + this seed's slugs)
  delete from public.posts where body like 'A small garden can grow%' or body like 'A cleaner river starts%'
     or body like 'Just joined LeoBook%' or body like 'Free English reading hour%' or body like 'Heritage walk%';
  delete from public.good_deeds where user_id = me and status = 'verified'
     and (org_id is null or org_id in (select id from public.organizations where slug in (
          'green-circle-foundation','st-joseph-medical-center','bagmati-green-circle','patan-learning-collective','valley-blood-link',
          'thamel-heritage-volunteers','boudha-care-network','kirtipur-youth-forum','bhaktapur-wellness-circle')));
  delete from public.organizations where slug in (
          'green-circle-foundation','st-joseph-medical-center','bagmati-green-circle','patan-learning-collective','valley-blood-link',
          'thamel-heritage-volunteers','boudha-care-network','kirtipur-youth-forum','bhaktapur-wellness-circle');

  -- Pages and groups. The first three are managed by you; the rest are "nearby organizations" to discover.
  insert into public.organizations (slug, name, type, verified, ai_verified, ai_verified_since, owner_id, location, location_note, lat, lng, tagline, headline, about, legal_status, impact, follower_count)
  values ('bagmati-green-circle', 'Bagmati Green Circle', 'ngo', true, true, 2021, me, 'Kathmandu', 'Serving Kathmandu, Lalitpur and Bhaktapur', 27.7172, 85.3240,
      'Cleaner rivers, greener neighborhoods, stronger communities across the Valley.', 'A cleaner valley belongs to everyone.',
      'We bring neighbors, students and local ward offices together for riverbank cleanups, tree planting and community gardens across the Kathmandu Valley.',
      'Registered non-profit (demo)', '[{"value":"38","label":"Cleanups led"},{"value":"6.4K","label":"Hours served"},{"value":"21","label":"Active projects"}]', 4820)
  returning id into grn;

  insert into public.organizations (slug, name, type, verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('patan-learning-collective', 'Patan Learning Collective', 'collective', true, me, 'Lalitpur', 'Free learning for children and adults', 27.6727, 85.3250,
      'Free reading, English and digital-skills sessions in Lalitpur and Kirtipur.', 'Volunteer teachers run free weekend sessions for school children and adult learners.', 1260)
  returning id into lrn;

  insert into public.organizations (slug, name, type, verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('valley-blood-link', 'Valley Blood Link', 'health', true, me, 'Kathmandu', 'Coordinating blood requests with Valley hospitals', 27.7035, 85.3134,
      'Connecting verified blood requests with willing donors in the Kathmandu Valley.', 'A demo health organization that raises verified emergency blood requests.', 930)
  returning id into blood;

  insert into public.organizations (slug, name, type, verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('thamel-heritage-volunteers', 'Thamel Heritage Volunteers', 'collective', true, creator, 'Thamel, Kathmandu', 'Keeping heritage streets clean', 27.7154, 85.3123,
      'Neighbors caring for Thamel and Kathmandu Durbar Square streets.', 'Weekly litter picks and heritage walks for residents, shopkeepers and visitors.', 760)
  returning id into thamel;

  insert into public.organizations (slug, name, type, verified, ai_verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('boudha-care-network', 'Boudha Care Network', 'ngo', true, true, creator, 'Boudha, Kathmandu', 'Elder care and winter relief', 27.7215, 85.3620,
      'Visiting elders and delivering warm clothing around Boudhanath.', 'Volunteers visit older neighbors, run winter drives and support local clinics.', 1480)
  returning id into boudha;

  insert into public.organizations (slug, name, type, verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('kirtipur-youth-forum', 'Kirtipur Youth Forum', 'collective', true, creator, 'Kirtipur', 'Student-led community projects', 27.6788, 85.2778,
      'Students mentoring students across Kirtipur.', 'Career talks, study circles and volunteer days led by university students.', 540)
  returning id into kirti;

  insert into public.organizations (slug, name, type, verified, owner_id, location, location_note, lat, lng, tagline, about, follower_count)
  values ('bhaktapur-wellness-circle', 'Bhaktapur Wellness Circle', 'ngo', true, creator, 'Bhaktapur', 'Free community health checks', 27.6710, 85.4298,
      'Free health camps with volunteer clinicians in Bhaktapur.', 'Volunteer doctors and nurses run monthly blood-pressure and wellness camps.', 880)
  returning id into bhak;

  -- Events and volunteer opportunities, scheduled in Nepal time. Skills match what members list on their profile.
  insert into public.events (org_id, title, kind, format_label, starts_at, location, cause, points, skills_wanted, lat, lng, description) values
   (grn,    'Bagmati riverbank cleanup',           'event',    'Volunteer drive',       (base + interval '3 days 7 hours 30 minutes')  at time zone 'Asia/Kathmandu', 'Thapathali, Kathmandu',        'Environment', 120, '{outdoor work,teamwork}',  27.6946, 85.3203, 'Gloves, bags and tea provided. We clear plastic and silt from the riverbank near Thapathali. Closed shoes recommended.'),
   (lrn,    'Free English reading hour',           'event',    'Free learning session', (base + interval '4 days 15 hours')            at time zone 'Asia/Kathmandu', 'Patan Durbar Square, Lalitpur','Education',   100, '{teaching,english}',       27.6727, 85.3250, 'Read aloud and practise English with school-age learners. No teaching experience needed.'),
   (thamel, 'Heritage walk and litter pick',       'event',    'Volunteer drive',       (base + interval '5 days 7 hours')             at time zone 'Asia/Kathmandu', 'Thamel, Kathmandu',           'Environment', 100, '{teamwork,outdoor work}',  27.7154, 85.3123, 'Walk the lanes between Thamel and Durbar Marg, picking up litter and chatting with shopkeepers.'),
   (grn,    'Tree planting at Shivapuri foothills','event',    'Hands-on workshop',     (base + interval '6 days 8 hours')             at time zone 'Asia/Kathmandu', 'Budhanilkantha',              'Environment', 120, '{gardening,outdoor work}', 27.7770, 85.3626, 'Plant native saplings with local guides and learn how to care for them. Bring water and sun protection.'),
   (boudha, 'Elder-care visits around Boudha',     'event',    'Care visit',            (base + interval '7 days 11 hours')            at time zone 'Asia/Kathmandu', 'Boudhanath',                  'Health',      100, '{counselling,first aid}',  27.7215, 85.3620, 'Visit older neighbors in pairs, share tea and help with small errands. Orientation provided.'),
   (grn,    'Winter blanket collection drive',     'event',    'Collection drive',      (base + interval '8 days 10 hours')            at time zone 'Asia/Kathmandu', 'Boudhanath',                  'Relief',      100, '{logistics,driving}',      27.7230, 85.3600, 'Help sort and pack blankets and warm clothing for families before the cold season.'),
   (kirti,  'Youth career talk',                   'event',    'Free learning session', (base + interval '9 days 15 hours')            at time zone 'Asia/Kathmandu', 'Kirtipur',                    'Education',   100, '{mentoring,teaching}',     27.6788, 85.2778, 'Share your career story with university students and answer their questions.'),
   (bhak,   'Community health camp',               'event',    'Community health camp', (base + interval '10 days 9 hours')            at time zone 'Asia/Kathmandu', 'Bhaktapur Durbar Square',     'Health',      100, '{first aid,counselling}',  27.6722, 85.4298, 'Support free blood-pressure and basic health checks run by volunteer clinicians.'),
   (lrn,    'Digital skills for youth',            'event',    'Free learning session', (base + interval '12 days 14 hours')           at time zone 'Asia/Kathmandu', 'Kirtipur',                    'Education',   100, '{teaching,computers}',     27.6830, 85.2800, 'Teach basic computer and phone skills to first-time learners.'),
   (blood,  'Blood donation camp',                 'event',    'Donation camp',         (base + interval '14 days 9 hours')            at time zone 'Asia/Kathmandu', 'Maharajgunj, Kathmandu',      'Health',      200, '{first aid}',              27.7360, 85.3303, 'Walk-in blood donation camp with trained staff. Eat well and bring a photo ID.');
  select id into ev1 from public.events where org_id = grn order by starts_at limit 1;

  -- Posts: organization updates + a personal post, so the global feed, profiles and pages all have content
  insert into public.posts (author_id, org_id, body, media, event_id, is_initiative, like_count, comment_count, share_count, location_text)
  values (me, grn, 'A cleaner river starts with neighbors. This weekend, 34 volunteers cleared a stretch of the Bagmati riverbank near Thapathali. Join us for the next one.',
          jsonb_build_array(jsonb_build_object('url', img, 'type', 'image')), ev1, true, 248, 31, 18, 'Thapathali, Kathmandu');
  insert into public.posts (author_id, org_id, body, location_text, like_count, comment_count, share_count)
  values (me, lrn, 'Free English reading hour returns to Patan Durbar Square. Bring a child, a book, or just your voice.', 'Patan, Lalitpur', 96, 12, 7);
  insert into public.posts (author_id, org_id, body, location_text, like_count, comment_count, share_count)
  values (creator, thamel, 'Heritage walk and litter pick this weekend. Shopkeepers are bringing tea.', 'Thamel, Kathmandu', 61, 9, 4);
  insert into public.posts (author_id, body, location_text)
  values (me, 'Just joined LeoBook. Looking for a weekend cleanup near Kathmandu. Any recommendations?', 'Kathmandu');

  insert into public.org_gallery (org_id, url, caption, position) values
    (grn, img, 'Bagmati riverbank', 0), (grn, img, '34 volunteers', 1), (grn, img, 'Tree planting day', 2);

  -- Emergency blood request with the SAME blood group as you, so "Your blood group is a match" is true.
  if bg is not null then
    insert into public.emergency_requests (org_id, created_by, blood_group, units_needed, hospital, location, lat, lng, needed_by)
    values (blood, creator, bg, 3, 'Bir Hospital, Mahaboudha', 'Kathmandu', 27.7035, 85.3134, ((base + interval '18 hours') at time zone 'Asia/Kathmandu'))
    returning id into req;
    if creator = me and donor then   -- creators are excluded from auto-matching; add yourself by hand for the demo
      insert into public.emergency_matches (request_id, user_id) values (req, me) on conflict do nothing;
    end if;
  end if;

  -- Verified impact so Your World, Rewards and the leaderboard have data (no blood donation: it would start the 56-day cool-down).
  insert into public.good_deeds (user_id, org_id, kind, hours, quantity, status) values
    (me, grn, 'volunteer', 8, 1, 'verified'), (me, lrn, 'volunteer', 4, 1, 'verified'),
    (me, grn, 'invite', null, 2, 'verified'), (me, grn, 'event', null, 1, 'verified');
end $$;
