create table if not exists public.rule_snapshot (
    id bigint primary key,
    rule_id bigint not null,
    rule_content text not null,
    version integer not null,
    change_desc varchar(255) null,
    create_user varchar(64) null,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_rule_snapshot_rule_version on public.rule_snapshot (rule_id, version) where delete_flag = 0;
create index if not exists idx_rule_snapshot_rule on public.rule_snapshot (rule_id);

create table if not exists public.rule_synonym (
    id bigint primary key,
    origin_word varchar(128) not null,
    synonym_word varchar(128) not null,
    priority integer not null default 50,
    status smallint not null default 1,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create index if not exists idx_rule_synonym_origin on public.rule_synonym (origin_word);
create index if not exists idx_rule_synonym_status on public.rule_synonym (status);
create index if not exists idx_rule_synonym_priority on public.rule_synonym (priority desc);

create table if not exists public.user_session (
    id bigint primary key,
    session_id varchar(64) not null,
    user_ip varchar(64) null,
    current_state varchar(128) null,
    context_data text null,
    last_active_time timestamptz not null default now(),
    expire_time timestamptz not null default (now() + interval '30 minutes'),
    session_status smallint not null default 1,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_user_session_session_id on public.user_session (session_id) where delete_flag = 0;
create index if not exists idx_user_session_expire_time on public.user_session (expire_time);
create index if not exists idx_user_session_status on public.user_session (session_status);

create table if not exists public.request_log (
    id bigint primary key,
    session_id varchar(64) null,
    request_uuid varchar(64) not null,
    request_type varchar(64) not null,
    request_content text null,
    response_content text null,
    rule_id bigint null,
    request_status smallint not null,
    cost_time bigint null,
    request_ip varchar(64) null,
    is_sample smallint not null default 0,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_request_log_request_uuid on public.request_log (request_uuid) where delete_flag = 0;
create index if not exists idx_request_log_session_id on public.request_log (session_id);
create index if not exists idx_request_log_rule_id on public.request_log (rule_id);
create index if not exists idx_request_log_create_time on public.request_log (create_time);

do $$
declare
    schema_name text;
begin
    for schema_name in
        select schema_name
        from information_schema.schemata
        where schema_name like 'tenant\_%' escape '\'
    loop
        execute 'create table if not exists ' || quote_ident(schema_name) || '.rule_snapshot (like public.rule_snapshot including all)';
        execute 'create table if not exists ' || quote_ident(schema_name) || '.rule_synonym (like public.rule_synonym including all)';
        execute 'create table if not exists ' || quote_ident(schema_name) || '.user_session (like public.user_session including all)';
        execute 'create table if not exists ' || quote_ident(schema_name) || '.request_log (like public.request_log including all)';
    end loop;
end
$$;
