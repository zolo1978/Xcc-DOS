package com.xccdos.prolog.multitenancy;

import java.util.Locale;

public final class TenantSchemaNames {

    private TenantSchemaNames() {
    }

    public static String forTenantCode(String tenantCode) {
        String normalized = tenantCode.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
        return "tenant_" + normalized;
    }
}
