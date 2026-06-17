package com.xccdos.prolog.tenant.domain;

import java.time.OffsetDateTime;

public enum TenantRuntimeStatus {
    ACTIVE("active"),
    INACTIVE("inactive"),
    EXPIRED("expired");

    private final String apiValue;

    TenantRuntimeStatus(String apiValue) {
        this.apiValue = apiValue;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static TenantRuntimeStatus fromApiValue(String apiValue) {
        for (TenantRuntimeStatus value : values()) {
            if (value.apiValue.equals(apiValue)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown tenant status: " + apiValue);
    }

    public static TenantRuntimeStatus fromEntity(TenantEntity tenant) {
        if (tenant.getStatus() == TenantDbStatus.DISABLED) {
            return INACTIVE;
        }
        OffsetDateTime expireTime = tenant.getExpireTime();
        if (expireTime != null && expireTime.isBefore(OffsetDateTime.now())) {
            return EXPIRED;
        }
        return ACTIVE;
    }
}
