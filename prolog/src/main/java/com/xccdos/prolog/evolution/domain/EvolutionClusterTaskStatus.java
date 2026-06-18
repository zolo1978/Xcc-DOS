package com.xccdos.prolog.evolution.domain;

import java.util.Arrays;

public enum EvolutionClusterTaskStatus {
    RUNNING((short) 0),
    DONE((short) 1),
    FAILED((short) 2);

    private final short code;

    EvolutionClusterTaskStatus(short code) {
        this.code = code;
    }

    public short getCode() {
        return code;
    }

    public static EvolutionClusterTaskStatus fromCode(short code) {
        return Arrays.stream(values())
                .filter(value -> value.code == code)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown evolutionClusterTaskStatus code: " + code));
    }
}
