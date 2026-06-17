package com.xccdos.prolog.rule.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateRuleRequest(
        @NotBlank(message = "ruleCode is required") String ruleCode,
        @NotBlank(message = "ruleName is required") String ruleName,
        @NotBlank(message = "ruleContent is required") String ruleContent,
        @NotBlank(message = "ruleType is required") String ruleType,
        @Pattern(regexp = "^$|\\d+$", message = "parentRuleId must be numeric") String parentRuleId,
        Integer grayRate
) {
}
