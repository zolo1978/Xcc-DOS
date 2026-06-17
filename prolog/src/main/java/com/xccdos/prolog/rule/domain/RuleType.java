package com.xccdos.prolog.rule.domain;

import java.util.Arrays;

public enum RuleType {
    PROCESS((short) 1, "process"),
    VALIDATION((short) 2, "validation"),
    ROUTING((short) 3, "routing");

    private final short code;
    private final String apiValue;

    RuleType(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static RuleType fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ruleType: " + apiValue));
    }

    public static RuleType fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ruleType code: " + code));
    }
}
