package com.xccdos.prolog.evolution.domain;

import java.util.Arrays;

public enum EvolutionClusterTriggerType {
    MANUAL((short) 0),
    SCHEDULED((short) 1);

    private final short code;

    EvolutionClusterTriggerType(short code) {
        this.code = code;
    }

    public short getCode() {
        return code;
    }

    public static EvolutionClusterTriggerType fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown evolutionClusterTriggerType code: " + code));
    }
}
