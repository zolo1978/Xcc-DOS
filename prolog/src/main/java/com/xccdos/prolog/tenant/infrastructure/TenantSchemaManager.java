package com.xccdos.prolog.tenant.infrastructure;

import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class TenantSchemaManager {

    private final JdbcTemplate jdbcTemplate;

    public TenantSchemaManager(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String createSchemaForTenant(String tenantCode) {
        String schemaName = TenantSchemaNames.forTenantCode(tenantCode);
        jdbcTemplate.execute("create schema if not exists " + schemaName);
        jdbcTemplate.execute("create table if not exists " + schemaName + ".sys_user (like public.sys_user including all)");
        jdbcTemplate.execute("create table if not exists " + schemaName + ".rule_prolog (like public.rule_prolog including all)");
        jdbcTemplate.execute("create table if not exists " + schemaName + ".rule_snapshot (like public.rule_snapshot including all)");
        jdbcTemplate.execute("create table if not exists " + schemaName + ".rule_synonym (like public.rule_synonym including all)");
        jdbcTemplate.execute("create table if not exists " + schemaName + ".user_session (like public.user_session including all)");
        jdbcTemplate.execute("create table if not exists " + schemaName + ".request_log (like public.request_log including all)");
        return schemaName;
    }
}
