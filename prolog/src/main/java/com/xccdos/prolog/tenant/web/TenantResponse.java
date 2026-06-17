package com.xccdos.prolog.tenant.web;

import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRuntimeStatus;
import java.time.OffsetDateTime;

public record TenantResponse(
        String id,
        String tenantName,
        String tenantCode,
        String isolateType,
        String status,
        OffsetDateTime expireTime,
        String contactPerson,
        String contactPhone
) {
    public static TenantResponse fromEntity(TenantEntity entity) {
        return new TenantResponse(
                String.valueOf(entity.getId()),
                entity.getTenantName(),
                entity.getTenantCode(),
                entity.getIsolateType().getApiValue(),
                TenantRuntimeStatus.fromEntity(entity).getApiValue(),
                entity.getExpireTime(),
                entity.getContactPerson(),
                entity.getContactPhone()
        );
    }
}
