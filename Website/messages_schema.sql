-- Messaging schema for one-to-one and group chats
-- Run this in your Supabase SQL editor

-- Conversations
create table if not exists public.conversations (
  id bigserial primary key,
  is_group boolean not null default false,
  title text,
  created_at timestamptz not null default now()
);

-- Participants
create table if not exists public.conversation_participants (
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  role text not null default 'member',
  added_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- Messages
create table if not exists public.messages (
  id bigserial primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

-- Helpful indexes
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_participants_user on public.conversation_participants(user_id);

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Policies: a user may see conversations they participate in
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'Select conversations by participant'
  ) then
    create policy "Select conversations by participant" on public.conversations
      for select using (
        exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Insert conversations: allowed to anyone authenticated (creator must add themselves as participant)
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'Insert conversations'
  ) then
    create policy "Insert conversations" on public.conversations
      for insert with check (auth.uid() is not null);
  end if;
end $$;

-- Participants policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='conversation_participants' and policyname='Manage own participation'
  ) then
    create policy "Manage own participation" on public.conversation_participants
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Messages policies: participants can read and write
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='Participants can read messages'
  ) then
    create policy "Participants can read messages" on public.messages
      for select using (
        exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='Participants can insert messages'
  ) then
    create policy "Participants can insert messages" on public.messages
      for insert with check (
        sender_id = auth.uid() and
        exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;


