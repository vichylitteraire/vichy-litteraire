create table if not exists public.submission_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists submission_rate_limits_ip_created_idx on public.submission_rate_limits(ip_hash, created_at desc);
alter table public.submission_rate_limits enable row level security;
revoke all on public.submission_rate_limits from anon, authenticated;

create or replace function public.register_submission_attempt(target_ip_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare recent_count integer;
begin
  delete from public.submission_rate_limits where created_at < now() - make_interval(hours => 24);
  select count(*) into recent_count from public.submission_rate_limits
    where ip_hash = target_ip_hash and created_at > now() - make_interval(hours => 1);
  if recent_count >= 3 then return false; end if;
  insert into public.submission_rate_limits(ip_hash) values(target_ip_hash);
  return true;
end $$;
revoke all on function public.register_submission_attempt(text) from public, anon, authenticated;
