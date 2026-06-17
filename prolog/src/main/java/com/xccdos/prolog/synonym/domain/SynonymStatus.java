package com.xccdos.prolog.synonym.domain;

import java.util.Arrays;

public enum SynonymStatus {
    ACTIVE((short) 1, "active"),
    INACTIVE((short) 2, "inactive");

    private final short code;
    private final String apiValue;

    SynonymStatus(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static SynonymStatus fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown synonymStatus: " + apiValue));
    }

    public static SynonymStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown synonymStatus code: " + code));
    }
}
