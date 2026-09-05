create table if not exists public.letter_likes (
  id bigint generated always as identity primary key,
  letter_id text not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (letter_id, visitor_id)
);

create table if not exists public.letter_submissions (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 1 and 80),
  city text not null check (char_length(city) between 1 and 80),
  country text not null check (char_length(country) between 1 and 80),
  body text not null check (char_length(body) between 20 and 40000),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now()
);

alter table public.letter_likes enable row level security;
alter table public.letter_submissions enable row level security;
revoke all on public.letter_likes from anon, authenticated;
revoke all on public.letter_submissions from anon, authenticated;

create or replace function public.get_letter_likes(letter_ids text[])
returns table(letter_id text, likes_count bigint)
language sql stable security definer set search_path = ''
as $$ select l.letter_id, count(*)::bigint from public.letter_likes l where l.letter_id = any(letter_ids) group by l.letter_id $$;

create or replace function public.like_letter(target_letter_id text, target_visitor_id uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare total bigint;
begin
  if char_length(target_letter_id) < 3 or char_length(target_letter_id) > 100 then raise exception 'invalid letter'; end if;
  insert into public.letter_likes(letter_id, visitor_id) values(target_letter_id, target_visitor_id) on conflict do nothing;
  select count(*) into total from public.letter_likes where letter_id=target_letter_id;
  return total;
end $$;

revoke all on function public.get_letter_likes(text[]) from public;
revoke all on function public.like_letter(text,uuid) from public;
grant execute on function public.get_letter_likes(text[]) to anon, authenticated;
grant execute on function public.like_letter(text,uuid) to anon, authenticated;
