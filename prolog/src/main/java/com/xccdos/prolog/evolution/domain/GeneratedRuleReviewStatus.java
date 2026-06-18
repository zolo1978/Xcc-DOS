package com.xccdos.prolog.evolution.domain;

import java.util.Arrays;

public enum GeneratedRuleReviewStatus {
    PENDING_REVIEW((short) 0),
    APPROVED((short) 1),
    REJECTED((short) 2);

    private final short code;

    GeneratedRuleReviewStatus(short code) {
        this.code = code;
    }

    public short getCode() {
        return code;
    }

    public static GeneratedRuleReviewStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown generatedRuleReviewStatus code: " + code));
    }
}
