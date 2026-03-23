-- The Nucleus — Initial Schema (paste into Supabase SQL Editor)

create type pipeline_stage as enum ('booked','showed','no_show','disqualified','qualified','second_call_booked','proposal_sent','closed_won','closed_lost','abandoned');
create type creative_status as enum ('active','paused','retired');
create type reminder_type as enum ('email','sms');
create type reminder_trigger as enum ('24hr','3hr','15min','nudge');
create type reminder_status as enum ('pending','sent','failed');

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, phone text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  industry text, revenue_range text, client_value text,
  stage pipeline_stage not null default 'booked',
  opted_in_at timestamptz, booking_completed boolean default false,
  booked_at timestamptz, call_datetime timestamptz, call_timezone text,
  call_notes_auto text, call_notes_manual text, second_call_datetime timestamptz,
  proposal_sent boolean default false, proposal_sent_at timestamptz,
  proposal_value decimal(10,2), revenue decimal(10,2), close_reason text,
  last_contact_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table stage_history (
  id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete cascade,
  from_stage pipeline_stage, to_stage pipeline_stage not null,
  changed_at timestamptz default now(), changed_by text default 'manual', auto_reason text
);

create table ad_creatives (
  id uuid primary key default gen_random_uuid(), meta_creative_id text unique, name text not null,
  utm_content_value text unique, hook_text text, full_script text, video_url text, hook_type text,
  iterated_from uuid references ad_creatives(id), status creative_status default 'active',
  launched_at date, notes text, first_seen date, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table ad_performance_daily (
  id uuid primary key default gen_random_uuid(), creative_id uuid references ad_creatives(id) on delete cascade,
  date date not null, spend decimal(10,2) default 0, impressions integer default 0, clicks integer default 0,
  unique(creative_id, date)
);

create table call_transcripts (
  id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete cascade,
  fireflies_meeting_id text unique, transcript_text text, ai_summary text,
  ai_qualified boolean, ai_followup_booked boolean, ai_followup_date timestamptz,
  ai_objections text, processed_at timestamptz default now()
);

create table reminders (
  id uuid primary key default gen_random_uuid(), lead_id uuid references leads(id) on delete cascade,
  type reminder_type not null, trigger reminder_trigger not null,
  scheduled_for timestamptz not null, sent_at timestamptz, status reminder_status default 'pending'
);

create table partial_leads (
  id uuid primary key default gen_random_uuid(), name text, email text, phone text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  opted_in_at timestamptz default now(), converted_to_lead boolean default false,
  nudge_sent boolean default false, created_at timestamptz default now()
);

create index leads_stage_idx on leads(stage);
create index leads_utm_content_idx on leads(utm_content);
create index ad_perf_creative_date_idx on ad_performance_daily(creative_id, date);

create or replace function update_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger leads_updated_at before update on leads for each row execute function update_updated_at();
create trigger creatives_updated_at before update on ad_creatives for each row execute function update_updated_at();

alter table leads enable row level security;
alter table ad_creatives enable row level security;
alter table ad_performance_daily enable row level security;
alter table call_transcripts enable row level security;
alter table reminders enable row level security;
alter table partial_leads enable row level security;
alter table stage_history enable row level security;

create policy "allow all" on leads for all using (true);
create policy "allow all" on ad_creatives for all using (true);
create policy "allow all" on ad_performance_daily for all using (true);
create policy "allow all" on call_transcripts for all using (true);
create policy "allow all" on reminders for all using (true);
create policy "allow all" on partial_leads for all using (true);
create policy "allow all" on stage_history for all using (true);
