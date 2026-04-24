create extension if not exists pgcrypto;

create table if not exists public.log_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'life',
  mood text,
  location text not null default '',
  visibility text not null default 'private',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  source_type text not null default 'manual',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.log_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.log_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.log_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.log_post_tags (
  post_id uuid not null references public.log_posts(id) on delete cascade,
  tag_id uuid not null references public.log_tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(post_id, tag_id)
);

create table if not exists public.log_post_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.log_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  target_title text,
  created_at timestamptz not null default now()
);

create index if not exists log_posts_user_created_idx on public.log_posts(user_id, created_at desc);
create index if not exists log_posts_user_category_idx on public.log_posts(user_id, category);
create index if not exists log_post_images_user_post_idx on public.log_post_images(user_id, post_id, sort_order);
create index if not exists log_tags_user_usage_idx on public.log_tags(user_id, usage_count desc);
create index if not exists log_post_tags_user_post_idx on public.log_post_tags(user_id, post_id);
create index if not exists log_post_links_user_post_idx on public.log_post_links(user_id, post_id);

alter table public.log_posts enable row level security;
alter table public.log_post_images enable row level security;
alter table public.log_tags enable row level security;
alter table public.log_post_tags enable row level security;
alter table public.log_post_links enable row level security;

drop policy if exists "log_posts_select_own" on public.log_posts;
create policy "log_posts_select_own" on public.log_posts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "log_posts_insert_own" on public.log_posts;
create policy "log_posts_insert_own" on public.log_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "log_posts_update_own" on public.log_posts;
create policy "log_posts_update_own" on public.log_posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "log_posts_delete_own" on public.log_posts;
create policy "log_posts_delete_own" on public.log_posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "log_post_images_select_own" on public.log_post_images;
create policy "log_post_images_select_own" on public.log_post_images for select to authenticated using (auth.uid() = user_id);
drop policy if exists "log_post_images_insert_own" on public.log_post_images;
create policy "log_post_images_insert_own" on public.log_post_images for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "log_post_images_update_own" on public.log_post_images;
create policy "log_post_images_update_own" on public.log_post_images for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "log_post_images_delete_own" on public.log_post_images;
create policy "log_post_images_delete_own" on public.log_post_images for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "log_tags_select_own" on public.log_tags;
create policy "log_tags_select_own" on public.log_tags for select to authenticated using (auth.uid() = user_id);
drop policy if exists "log_tags_insert_own" on public.log_tags;
create policy "log_tags_insert_own" on public.log_tags for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "log_tags_update_own" on public.log_tags;
create policy "log_tags_update_own" on public.log_tags for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "log_tags_delete_own" on public.log_tags;
create policy "log_tags_delete_own" on public.log_tags for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "log_post_tags_select_own" on public.log_post_tags;
create policy "log_post_tags_select_own" on public.log_post_tags for select to authenticated using (auth.uid() = user_id);
drop policy if exists "log_post_tags_insert_own" on public.log_post_tags;
create policy "log_post_tags_insert_own" on public.log_post_tags for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "log_post_tags_update_own" on public.log_post_tags;
create policy "log_post_tags_update_own" on public.log_post_tags for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "log_post_tags_delete_own" on public.log_post_tags;
create policy "log_post_tags_delete_own" on public.log_post_tags for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "log_post_links_select_own" on public.log_post_links;
create policy "log_post_links_select_own" on public.log_post_links for select to authenticated using (auth.uid() = user_id);
drop policy if exists "log_post_links_insert_own" on public.log_post_links;
create policy "log_post_links_insert_own" on public.log_post_links for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "log_post_links_update_own" on public.log_post_links;
create policy "log_post_links_update_own" on public.log_post_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "log_post_links_delete_own" on public.log_post_links;
create policy "log_post_links_delete_own" on public.log_post_links for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('log-images', 'log-images', false)
on conflict (id) do nothing;

drop policy if exists "log_images_select_own" on storage.objects;
create policy "log_images_select_own"
on storage.objects
for select
to authenticated
using (bucket_id = 'log-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "log_images_insert_own" on storage.objects;
create policy "log_images_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'log-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "log_images_update_own" on storage.objects;
create policy "log_images_update_own"
on storage.objects
for update
to authenticated
using (bucket_id = 'log-images' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'log-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "log_images_delete_own" on storage.objects;
create policy "log_images_delete_own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'log-images' and auth.uid()::text = (storage.foldername(name))[1]);
