-- Spark schema v1. Every tenant table carries org_id and is protected by row-level security (FORCE, so the
-- owning role is subject to it too). The app sets app.org_id per transaction; a few system paths (sign-in,
-- session lookup, migrations) set app.bypass. No table stores page content or field values.

create extension if not exists pgcrypto;

create or replace function spark_org() returns uuid language sql stable as
  $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;
create or replace function spark_bypass() returns boolean language sql stable as
  $$ select coalesce(current_setting('app.bypass', true), '') = 'on' $$;

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  approved_domains text[] not null default '{}',
  ai_provider text not null default 'anthropic',
  ai_model text,
  retention_days int not null default 365,
  is_operator boolean not null default false,  -- the Matchlight org that runs the platform
  -- White label: { displayName, logoUrl (private Blob path), accent, accentInk, surface }; validated in code.
  branding jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  email text not null,
  name text not null,
  password_hash text,
  roles text[] not null default '{learner}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
create unique index users_email_global on users (lower(email));

create table invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  token_hash text not null unique,
  email text not null,
  roles text[] not null,
  created_by uuid references users on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  user_id uuid not null references users on delete cascade,
  token_hash text not null unique,
  kind text not null check (kind in ('web', 'ext', 'ext_refresh')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table ext_codes (
  code_hash text primary key,
  org_id uuid not null references orgs on delete cascade,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table processes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  slug text not null,
  title text not null,
  draft jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  latest_version int not null default 0,
  created_by uuid references users on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table process_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  process_id uuid not null references processes on delete cascade,
  version int not null,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references users on delete set null,
  unique (process_id, version)
);

create table part_states (
  org_id uuid not null references orgs on delete cascade,
  user_id uuid not null references users on delete cascade,
  process_id uuid not null references processes on delete cascade,
  step_id text not null,
  level smallint not null check (level between 1 and 4),
  streak smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, process_id, step_id)
);

create table runs (
  id uuid primary key,
  org_id uuid not null references orgs on delete cascade,
  user_id uuid not null references users on delete cascade,
  process_id uuid not null references processes on delete cascade,
  version int not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('completed', 'abandoned')),
  independence smallint,
  misses smallint not null default 0
);
create index runs_by_user on runs (org_id, user_id, process_id, finished_at);

create table step_results (
  run_id uuid not null references runs on delete cascade,
  org_id uuid not null references orgs on delete cascade,
  step_id text not null,
  type text not null,
  level smallint,
  outcome text not null check (outcome in ('right', 'miss', 'done', 'skipped')),
  seconds int not null default 0,
  hints smallint not null default 0,
  resolved boolean,
  primary key (run_id, step_id)
);

-- Brand kit documents: Markdown the customer uploads (voice, glossary, style rules). Fed to AI drafting and Ask.
create table brand_docs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  name text not null,
  kind text not null default 'style' check (kind in ('voice', 'glossary', 'style', 'reference')),
  body text not null,
  updated_by uuid references users on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table audit_log (
  id bigserial primary key,
  org_id uuid not null references orgs on delete cascade,
  actor_id uuid,
  action text not null,
  subject text,
  at timestamptz not null default now()
);

-- Row-level security: one policy per table, the same rule everywhere.
do $$
declare t text;
begin
  foreach t in array array['users','invites','sessions','ext_codes','processes','process_versions','part_states','runs','step_results','brand_docs','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (spark_bypass() or org_id = spark_org()) with check (spark_bypass() or org_id = spark_org())', t);
  end loop;
end $$;
alter table orgs enable row level security;
alter table orgs force row level security;
create policy org_isolation on orgs using (spark_bypass() or id = spark_org()) with check (spark_bypass());
