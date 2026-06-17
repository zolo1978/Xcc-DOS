package com.xccdos.prolog.session.domain;

import java.util.Arrays;

public enum SessionStatus {
    NORMAL((short) 1, "normal"),
    TIMEOUT((short) 2, "timeout"),
    LOGOUT((short) 3, "logout");

    private final short code;
    private final String apiValue;

    SessionStatus(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static SessionStatus fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown sessionStatus: " + apiValue));
    }

    public static SessionStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown sessionStatus code: " + code));
    }
}
