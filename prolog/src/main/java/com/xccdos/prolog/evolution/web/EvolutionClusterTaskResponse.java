package com.xccdos.prolog.evolution.web;

import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;

public record EvolutionClusterTaskResponse(
        String id,
        String status,
        Integer sampleCount,
        String triggerType,
        String clusterResult
) {

    public static EvolutionClusterTaskResponse fromEntity(EvolutionClusterTaskEntity entity) {
        return new EvolutionClusterTaskResponse(
                String.valueOf(entity.getId()),
                toStatus(entity.getStatus()),
                entity.getSampleCount(),
                toTriggerType(entity.getTriggerType()),
                entity.getClusterResult()
        );
    }

    private static String toStatus(EvolutionClusterTaskStatus status) {
        return switch (status) {
            case RUNNING -> "running";
            case DONE -> "done";
            case FAILED -> "failed";
        };
    }

    private static String toTriggerType(EvolutionClusterTriggerType triggerType) {
        return switch (triggerType) {
            case MANUAL -> "manual";
            case SCHEDULED -> "scheduled";
        };
    }
}
