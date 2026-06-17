package com.xccdos.prolog.tenant.domain;

public enum TenantDbStatus {
    DISABLED((short) 0),
    NORMAL((short) 1);

    private final short code;

    TenantDbStatus(short code) {
        this.code = code;
    }

    public short getCode() {
        return code;
    }

    public static TenantDbStatus fromCode(short code) {
        return code == 1 ? NORMAL : DISABLED;
    }
}
