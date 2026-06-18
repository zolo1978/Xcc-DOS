create table if not exists public.evolution_cluster_task (
    id bigint primary key,
    status smallint not null,
    sample_count integer not null default 0,
    cluster_result jsonb null,
    trigger_type smallint not null,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create index if not exists idx_evolution_cluster_task_status on public.evolution_cluster_task (status);
create index if not exists idx_evolution_cluster_task_trigger_type on public.evolution_cluster_task (trigger_type);
create index if not exists idx_evolution_cluster_task_tenant_id on public.evolution_cluster_task (tenant_id);
create index if not exists idx_evolution_cluster_task_create_time on public.evolution_cluster_task (create_time desc);

create table if not exists public.generated_rule (
    id bigint primary key,
    source_cluster_id bigint not null,
    rule_content text not null,
    confidence varchar(16) null,
    review_status smallint not null,
    reviewed_by varchar(64) null,
    review_comment varchar(255) null,
    langflow_run_id varchar(64) null,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create index if not exists idx_generated_rule_source_cluster on public.generated_rule (source_cluster_id);
create index if not exists idx_generated_rule_review_status on public.generated_rule (review_status);
create index if not exists idx_generated_rule_tenant_id on public.generated_rule (tenant_id);
create index if not exists idx_generated_rule_create_time on public.generated_rule (create_time desc);

do $$
declare
    schema_name text;
begin
    for schema_name in
        select schema_name
        from information_schema.schemata
        where schema_name like 'tenant\_%' escape '\'
    loop
        execute 'create table if not exists ' || quote_ident(schema_name) || '.evolution_cluster_task (like public.evolution_cluster_task including all)';
        execute 'create table if not exists ' || quote_ident(schema_name) || '.generated_rule (like public.generated_rule including all)';
    end loop;
end
$$;
