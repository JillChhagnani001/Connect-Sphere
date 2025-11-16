-- Run this script inside the Supabase SQL editor to enable moderator workflows.
-- It adds a single moderator role flag, ban tracking, and a moderation audit table.

-- Ensure pgcrypto extension exists for UUID generation
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists is_moderator boolean not null default false,
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists ban_last_updated timestamptz not null default now();

-- Only one moderator account should exist at a time
create unique index if not exists profiles_single_moderator_idx
  on public.profiles (is_moderator)
  where is_moderator;

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id),
  lift_reason text
);

create index if not exists user_bans_user_id_idx on public.user_bans(user_id, created_at desc);
create index if not exists user_bans_active_idx on public.user_bans(user_id) where lifted_at is null;

alter table public.user_bans enable row level security;

-- Allow users to see their own ban history
drop policy if exists "Users can view their bans" on public.user_bans;
create policy "Users can view their bans"
  on public.user_bans
  for select
  using (auth.uid() = user_id);

-- Moderator/service role will act through the backend using service key, so
-- mutations will go through the admin client and bypass RLS. Add a guard in
-- the API layer before mutating this table.

-- Helper function to stamp ban state onto the profile when a ban is issued or lifted
create or replace function public.refresh_profile_ban_state(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_record public.user_bans;
begin
  select ub.* into active_record
  from public.user_bans ub
  where ub.user_id = target_user
    and ub.lifted_at is null
    and (ub.expires_at is null or ub.expires_at > now())
  order by coalesce(ub.expires_at, 'infinity'::timestamptz) desc, ub.created_at desc
  limit 1;

  if found then
    update public.profiles
    set banned_until = active_record.expires_at,
        ban_reason = active_record.reason,
        ban_last_updated = now()
    where id = target_user;
  else
    update public.profiles
    set banned_until = null,
        ban_reason = null,
        ban_last_updated = now()
    where id = target_user;
  end if;
end;
$$;

create or replace function public.user_bans_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_ban_state(new.user_id);
  return new;
end;
$$;

create or replace function public.user_bans_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_ban_state(old.user_id);
  return old;
end;
$$;

create trigger user_bans_after_change_trg
  after insert or update on public.user_bans
  for each row
  execute procedure public.user_bans_after_change();

create trigger user_bans_after_delete_trg
  after delete on public.user_bans
  for each row
  execute procedure public.user_bans_after_delete();
