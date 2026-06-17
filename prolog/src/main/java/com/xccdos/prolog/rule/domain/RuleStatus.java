package com.xccdos.prolog.rule.domain;

import java.util.Arrays;

public enum RuleStatus {
    DRAFT((short) 0, "draft"),
    ACTIVE((short) 1, "active"),
    GRAY((short) 2, "gray"),
    INACTIVE((short) 3, "inactive");

    private final short code;
    private final String apiValue;

    RuleStatus(short code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public short getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static RuleStatus fromApiValue(String apiValue) {
        return Arrays.stream(values())
                .filter(value -> value.apiValue.equals(apiValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ruleStatus: " + apiValue));
    }

    public static RuleStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ruleStatus code: " + code));
    }
}
