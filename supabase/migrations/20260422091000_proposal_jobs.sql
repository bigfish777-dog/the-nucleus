create table if not exists proposal_jobs (
  id         uuid primary key default gen_random_uuid(),
  doc_url    text not null,
  slug       text not null,
  status     text not null default 'pending',   -- pending | processing | done | error
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Allow anon inserts (from the edge function) and reads (from the poller)
alter table proposal_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proposal_jobs'
      and policyname = 'Allow anon insert'
  ) then
    create policy "Allow anon insert" on proposal_jobs
      for insert with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proposal_jobs'
      and policyname = 'Allow anon select'
  ) then
    create policy "Allow anon select" on proposal_jobs
      for select using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proposal_jobs'
      and policyname = 'Allow anon update'
  ) then
    create policy "Allow anon update" on proposal_jobs
      for update using (true);
  end if;
end
$$;
