package com.xccdos.prolog.log.domain;

import java.util.Arrays;

public enum RequestStatus {
    SUCCESS((short) 1, "success"),
    FAILED((short) 2, "failed");

    private final short code;
    private final String apiValue;

    RequestStatus(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static RequestStatus fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown requestStatus: " + apiValue));
    }

    public static RequestStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown requestStatus code: " + code));
    }
}
