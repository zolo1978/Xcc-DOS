package com.xccdos.prolog.rule.web;

import jakarta.validation.constraints.Min;

public record RollbackRuleRequest(
        @Min(value = 1, message = "version must be at least 1")
        int version
) {
}
