create table public.teddy_settings (
  id text primary key check (id = 'owner'),
  value jsonb not null
);
create table public.teddy_sessions (
  environment text not null check (environment in ('production','preview','test')),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('owner','visitor')),
  expires_at timestamptz not null,
  primary key (environment, token_hash)
);
create index teddy_sessions_expiry on public.teddy_sessions (environment, expires_at);
create table public.teddy_plans (
  environment text not null check (environment in ('production','preview','test')),
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  activity text not null check (activity in ('Coffee','Ice cream','A walk')),
  day date not null,
  accepted_at timestamptz not null default now(),
  primary key (environment, visitor_hash)
);
create index teddy_plans_latest on public.teddy_plans (environment, accepted_at desc);
create table public.teddy_limits (
  environment text not null check (environment in ('production','preview','test')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null,
  expires_at timestamptz not null,
  primary key (environment, key_hash)
);

alter table public.teddy_settings enable row level security;
alter table public.teddy_sessions enable row level security;
alter table public.teddy_plans enable row level security;
alter table public.teddy_limits enable row level security;
revoke all on public.teddy_settings, public.teddy_sessions, public.teddy_plans, public.teddy_limits from public, anon, authenticated;
grant select, insert, update, delete on public.teddy_settings, public.teddy_sessions, public.teddy_plans, public.teddy_limits to service_role;

create function public.teddy_take_limit(p_environment text, p_key text, p_max integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare allowed boolean;
begin
  if p_environment not in ('production','preview','test') or p_key !~ '^[0-9a-f]{64}$' or p_max < 1 or p_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit';
  end if;
  insert into public.teddy_limits as existing (environment,key_hash,attempts,expires_at)
  values (p_environment,p_key,1,pg_catalog.now()+pg_catalog.make_interval(secs=>p_seconds))
  on conflict (environment,key_hash) do update set
    attempts=case when existing.expires_at<=pg_catalog.now() then 1 else least(existing.attempts+1,1000000) end,
    expires_at=case when existing.expires_at<=pg_catalog.now() then excluded.expires_at else existing.expires_at end
  returning attempts<=p_max into allowed;
  return allowed;
end;
$$;
revoke all on function public.teddy_take_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.teddy_take_limit(text,text,integer,integer) to service_role;
