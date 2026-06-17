package com.xccdos.prolog.tenant.domain;

import java.util.Arrays;

public enum TenantIsolationType {
    SHARED_RLS((short) 1, "shared_rls"),
    PHYSICAL((short) 2, "physical"),
    SCHEMA((short) 3, "schema");

    private final short code;
    private final String apiValue;

    TenantIsolationType(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static TenantIsolationType fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown isolateType: " + apiValue));
    }

    public static TenantIsolationType fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown isolateType code: " + code));
    }
}
