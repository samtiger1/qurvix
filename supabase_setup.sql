-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- Uses Supabase Auth, profiles, content and moderated comments.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'QURVIX member',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Gaming','Technology','Entertainment','News','Tools','Knowledge')),
  type text not null default 'article' check (type in ('article','download')),
  description text not null,
  image_url text,
  url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name','QURVIX member'))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Profiles readable by authenticated users" on public.profiles;
create policy "Profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
drop policy if exists "Users update own display name" on public.profiles;
create policy "Users update own display name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'user' or public.is_admin());

drop policy if exists "Published content public read" on public.content;
create policy "Published content public read" on public.content for select using (published = true or public.is_admin());
drop policy if exists "Admins insert content" on public.content;
create policy "Admins insert content" on public.content for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update content" on public.content;
create policy "Admins update content" on public.content for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete content" on public.content;
create policy "Admins delete content" on public.content for delete to authenticated using (public.is_admin());

drop policy if exists "Approved comments public read" on public.comments;
create policy "Approved comments public read" on public.comments for select using (approved = true or user_id = auth.uid() or public.is_admin());
drop policy if exists "Logged in users submit comments" on public.comments;
create policy "Logged in users submit comments" on public.comments for insert to authenticated with check (user_id = auth.uid() and approved = false);
drop policy if exists "Admins moderate comments" on public.comments;
create policy "Admins moderate comments" on public.comments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete comments" on public.comments;
create policy "Admins delete comments" on public.comments for delete to authenticated using (public.is_admin());

-- After signing up your own account, replace YOUR_AUTH_USER_UUID below
-- with the UUID shown in Authentication > Users, then run:
-- update public.profiles set role = 'admin' where id = 'YOUR_AUTH_USER_UUID';
