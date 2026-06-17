package com.xccdos.prolog.tenant.application;

import com.xccdos.prolog.common.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class TenantPublicLookupService {

    private final JdbcTemplate jdbcTemplate;

    public TenantPublicLookupService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Long requireTenantId(String tenantCode) {
        Long tenantId = jdbcTemplate.query(
                """
                select id
                from public.sys_tenant
                where tenant_code = ?
                  and delete_flag = 0
                limit 1
                """,
                resultSet -> resultSet.next() ? resultSet.getLong("id") : null,
                tenantCode
        );
        if (tenantId == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_NOT_FOUND", "Tenant not found");
        }
        return tenantId;
    }
}
