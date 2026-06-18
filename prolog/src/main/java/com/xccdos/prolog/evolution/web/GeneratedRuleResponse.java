package com.xccdos.prolog.evolution.web;

import com.xccdos.prolog.evolution.domain.GeneratedRuleEntity;
import com.xccdos.prolog.evolution.domain.GeneratedRuleReviewStatus;

public record GeneratedRuleResponse(
        String id,
        String sourceClusterId,
        String ruleContent,
        String confidence,
        String reviewStatus,
        String reviewedBy,
        String reviewComment,
        String langflowRunId
) {

    public static GeneratedRuleResponse fromEntity(GeneratedRuleEntity entity) {
        return new GeneratedRuleResponse(
                String.valueOf(entity.getId()),
                String.valueOf(entity.getSourceClusterId()),
                entity.getRuleContent(),
                entity.getConfidence(),
                toReviewStatus(entity.getReviewStatus()),
                entity.getReviewedBy(),
                entity.getReviewComment(),
                entity.getLangflowRunId()
        );
    }

    private static String toReviewStatus(GeneratedRuleReviewStatus reviewStatus) {
        return switch (reviewStatus) {
            case PENDING_REVIEW -> "pending_review";
            case APPROVED -> "approved";
            case REJECTED -> "rejected";
        };
    }
}
