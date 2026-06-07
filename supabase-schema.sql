-- Supabase schema for Smart Poll App
-- Simplified version with no external user table references

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Polls table stores polls and metadata
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration integer not null,
  expires_at timestamp with time zone not null,
  category text default 'General',
  created_by text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- Poll options are linked to polls and track vote totals
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  votes integer not null default 0,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- Questions table stores live Q&A items
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  votes integer not null default 0,
  pinned boolean not null default false,
  created_by text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

-- Votes table records poll vote activity
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

