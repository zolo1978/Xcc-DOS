package com.xccdos.prolog.session.web;

import com.xccdos.prolog.session.domain.UserSessionEntity;

public record SessionResponse(
        String id,
        String sessionId,
        String userIp,
        String currentState,
        String contextData,
        String lastActiveTime,
        String expireTime,
        String sessionStatus
) {
    public static SessionResponse fromEntity(UserSessionEntity entity) {
        return new SessionResponse(
                String.valueOf(entity.getId()),
                entity.getSessionId(),
                entity.getUserIp(),
                entity.getCurrentState(),
                entity.getContextData(),
                entity.getLastActiveTime() == null ? null : entity.getLastActiveTime().toString(),
                entity.getExpireTime() == null ? null : entity.getExpireTime().toString(),
                entity.getSessionStatus().getApiValue()
        );
    }
}
