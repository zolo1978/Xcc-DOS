package com.xccdos.prolog.synonym.web;

import com.xccdos.prolog.synonym.domain.RuleSynonymEntity;

public record SynonymResponse(
        String id,
        String originWord,
        String synonymWord,
        int priority,
        String status
) {
    public static SynonymResponse fromEntity(RuleSynonymEntity entity) {
        return new SynonymResponse(
                String.valueOf(entity.getId()),
                entity.getOriginWord(),
                entity.getSynonymWord(),
                entity.getPriority(),
                entity.getStatus().getApiValue()
        );
    }
}
