package com.xccdos.prolog.multitenancy;

public final class TenantContext {

    public static final String PUBLIC_SCHEMA = "public";

    private static final ThreadLocal<String> CURRENT_TENANT = ThreadLocal.withInitial(() -> PUBLIC_SCHEMA);
    private static final ThreadLocal<String> CURRENT_TENANT_CODE = new ThreadLocal<>();

    private TenantContext() {
    }

    public static String getCurrentTenantSchema() {
        return CURRENT_TENANT.get();
    }

    public static void setCurrentTenant(String tenantCode, String tenantSchema) {
        CURRENT_TENANT_CODE.set(tenantCode);
        CURRENT_TENANT.set(tenantSchema);
    }

    public static String getCurrentTenantCode() {
        return CURRENT_TENANT_CODE.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
        CURRENT_TENANT_CODE.remove();
    }
}
