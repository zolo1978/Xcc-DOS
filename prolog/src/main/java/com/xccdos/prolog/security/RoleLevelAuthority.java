package com.xccdos.prolog.security;

import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public final class RoleLevelAuthority {

    public static final short READ_ONLY = 1;
    public static final short OPERATOR = 2;
    public static final short TENANT_ADMIN = 3;

    public static final String READ_ONLY_ROLE = "ROLE_READONLY";
    public static final String OPERATOR_ROLE = "ROLE_OPERATOR";
    public static final String TENANT_ADMIN_ROLE = "ROLE_TENANT_ADMIN";

    private RoleLevelAuthority() {
    }

    public static List<? extends GrantedAuthority> authoritiesFor(short roleLevel) {
        return List.of(new SimpleGrantedAuthority(authorityFor(roleLevel)));
    }

    public static String authorityFor(short roleLevel) {
        return switch (roleLevel) {
            case READ_ONLY -> READ_ONLY_ROLE;
            case OPERATOR -> OPERATOR_ROLE;
            case TENANT_ADMIN -> TENANT_ADMIN_ROLE;
            default -> throw new IllegalArgumentException("Unknown role level: " + roleLevel);
        };
    }
}
