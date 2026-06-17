create table if not exists public.sys_tenant (
    id bigint primary key,
    tenant_name varchar(128) not null,
    tenant_code varchar(64) not null,
    isolate_type smallint not null,
    status smallint not null default 1,
    expire_time timestamptz null,
    contact_person varchar(64) null,
    contact_phone varchar(32) null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_sys_tenant_code on public.sys_tenant (tenant_code) where delete_flag = 0;
create index if not exists idx_sys_tenant_status on public.sys_tenant (status);

create table if not exists public.sys_user (
    id bigint primary key,
    username varchar(64) not null,
    password varchar(255) not null,
    nickname varchar(64) not null,
    role_level smallint not null,
    status smallint not null default 1,
    tenant_id bigint not null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_sys_user_username on public.sys_user (username) where delete_flag = 0;
create index if not exists idx_sys_user_tenant on public.sys_user (tenant_id);

create table if not exists public.rule_prolog (
    id bigint primary key,
    rule_name varchar(128) not null,
    rule_code varchar(64) not null,
    rule_content text not null,
    rule_type smallint not null,
    parent_id bigint null,
    status smallint not null default 0,
    version integer not null default 1,
    gray_rate integer not null default 100,
    is_auto_gen smallint not null default 0,
    tenant_id bigint null,
    create_time timestamptz not null default now(),
    update_time timestamptz not null default now(),
    delete_flag smallint not null default 0
);

create unique index if not exists uk_rule_prolog_code on public.rule_prolog (rule_code) where delete_flag = 0;
create index if not exists idx_rule_prolog_status on public.rule_prolog (status);
create index if not exists idx_rule_prolog_parent on public.rule_prolog (parent_id);
