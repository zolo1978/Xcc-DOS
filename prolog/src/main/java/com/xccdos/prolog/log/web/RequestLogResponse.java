package com.xccdos.prolog.log.web;

import com.xccdos.prolog.log.domain.RequestLogEntity;

public record RequestLogResponse(
        String id,
        String sessionId,
        String requestUuid,
        String requestType,
        String requestContent,
        String responseContent,
        String ruleId,
        String requestStatus,
        Long costTime,
        String requestIp,
        boolean sample
) {
    public static RequestLogResponse fromEntity(RequestLogEntity entity) {
        return new RequestLogResponse(
                String.valueOf(entity.getId()),
                entity.getSessionId(),
                entity.getRequestUuid(),
                entity.getRequestType(),
                entity.getRequestContent(),
                entity.getResponseContent(),
                entity.getRuleId() == null ? null : String.valueOf(entity.getRuleId()),
                entity.getRequestStatus().getApiValue(),
                entity.getCostTime(),
                entity.getRequestIp(),
                entity.getIsSample() == 1
        );
    }
}
