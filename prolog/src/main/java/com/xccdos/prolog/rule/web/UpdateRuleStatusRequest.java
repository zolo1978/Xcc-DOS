package com.xccdos.prolog.rule.web;

import jakarta.validation.constraints.NotBlank;

public record UpdateRuleStatusRequest(
        @NotBlank(message = "status is required") String status
) {
}
