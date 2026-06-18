package com.xccdos.prolog.evolution.web;

import jakarta.validation.constraints.NotBlank;

public record RejectGeneratedRuleRequest(
        @NotBlank(message = "reason is required") String reason
) {
}
