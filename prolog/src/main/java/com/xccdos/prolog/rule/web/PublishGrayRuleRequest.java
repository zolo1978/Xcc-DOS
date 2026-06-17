package com.xccdos.prolog.rule.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record PublishGrayRuleRequest(
        @Min(value = 0, message = "grayRate must be at least 0")
        @Max(value = 100, message = "grayRate must be at most 100")
        int grayRate
) {
}
