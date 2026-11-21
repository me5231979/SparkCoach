-- Bring your own AI key (BYOK) and plans/add-ons.
-- ai_key_enc: the customer's own AI provider key, AES-256-GCM encrypted with SPARK_ENCRYPTION_KEY (never returned).
-- features: add-on SKUs switched on for this org by the operator, e.g. {"managedAi": true, "reports": true}.
alter table orgs add column if not exists ai_key_enc text;
alter table orgs add column if not exists ai_key_hint text;
alter table orgs add column if not exists plan text not null default 'platform';
alter table orgs add column if not exists features jsonb not null default '{}';
