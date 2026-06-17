package com.xccdos.prolog.log.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateRequestLogRequest(
        String sessionId,
        @NotBlank(message = "requestUuid is required") String requestUuid,
        @NotBlank(message = "requestType is required") String requestType,
        String requestContent,
        String responseContent,
        String ruleId,
        @NotBlank(message = "requestStatus is required") String requestStatus,
        @NotNull(message = "costTime is required") Long costTime,
        String requestIp,
        boolean sample
) {
}
