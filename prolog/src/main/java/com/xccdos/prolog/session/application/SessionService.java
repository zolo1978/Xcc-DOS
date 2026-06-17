package com.xccdos.prolog.session.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.session.domain.SessionStatus;
import com.xccdos.prolog.session.domain.UserSessionEntity;
import com.xccdos.prolog.session.domain.UserSessionRepository;
import com.xccdos.prolog.session.web.SessionResponse;
import com.xccdos.prolog.session.web.UpdateSessionContextRequest;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {

    private final UserSessionRepository userSessionRepository;
    private final SnowflakeIdGenerator idGenerator;
    private final TenantPublicLookupService tenantPublicLookupService;
    private final Clock clock;

    public SessionService(
            UserSessionRepository userSessionRepository,
            SnowflakeIdGenerator idGenerator,
            TenantPublicLookupService tenantPublicLookupService,
            Clock clock
    ) {
        this.userSessionRepository = userSessionRepository;
        this.idGenerator = idGenerator;
        this.tenantPublicLookupService = tenantPublicLookupService;
        this.clock = clock;
    }

    @Transactional
    public SessionResponse createSession(String userIp, String currentState, String contextData) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        UserSessionEntity entity = new UserSessionEntity();
        entity.setId(idGenerator.nextId());
        entity.setSessionId(UUID.randomUUID().toString());
        entity.setUserIp(userIp);
        entity.setCurrentState(currentState);
        entity.setContextData(contextData);
        entity.setLastActiveTime(now);
        entity.setExpireTime(now.plusMinutes(30));
        entity.setSessionStatus(SessionStatus.NORMAL);
        entity.setTenantId(currentTenantIdOrNull());
        return SessionResponse.fromEntity(userSessionRepository.save(entity));
    }

    @Transactional
    public SessionResponse reconnect(String sessionId) {
        UserSessionEntity entity = getSessionEntity(sessionId);
        if (isExpired(entity)) {
            entity.setSessionStatus(SessionStatus.TIMEOUT);
            return SessionResponse.fromEntity(userSessionRepository.save(entity));
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        entity.setLastActiveTime(now);
        entity.setExpireTime(now.plusMinutes(30));
        entity.setSessionStatus(SessionStatus.NORMAL);
        return SessionResponse.fromEntity(userSessionRepository.save(entity));
    }

    @Transactional
    public SessionResponse getSession(String sessionId) {
        UserSessionEntity entity = getSessionEntity(sessionId);
        if (isExpired(entity)) {
            entity.setSessionStatus(SessionStatus.TIMEOUT);
            return SessionResponse.fromEntity(userSessionRepository.save(entity));
        }
        return SessionResponse.fromEntity(entity);
    }

    @Transactional
    public SessionResponse updateContext(String sessionId, UpdateSessionContextRequest request) {
        UserSessionEntity entity = getSessionEntity(sessionId);
        if (isExpired(entity)) {
            entity.setSessionStatus(SessionStatus.TIMEOUT);
            return SessionResponse.fromEntity(userSessionRepository.save(entity));
        }
        if (request.currentState() != null) {
            entity.setCurrentState(request.currentState());
        }
        if (request.contextData() != null) {
            entity.setContextData(request.contextData());
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        entity.setLastActiveTime(now);
        entity.setExpireTime(now.plusMinutes(30));
        return SessionResponse.fromEntity(userSessionRepository.save(entity));
    }

    @Transactional
    public SessionResponse logout(String sessionId) {
        UserSessionEntity entity = getSessionEntity(sessionId);
        entity.setSessionStatus(SessionStatus.LOGOUT);
        return SessionResponse.fromEntity(userSessionRepository.save(entity));
    }

    private UserSessionEntity getSessionEntity(String sessionId) {
        return userSessionRepository.findBySessionIdAndDeleteFlag(sessionId, (short) 0)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Session not found"));
    }

    private boolean isExpired(UserSessionEntity entity) {
        return entity.getExpireTime() != null && OffsetDateTime.now(clock).isAfter(entity.getExpireTime());
    }

    private Long currentTenantIdOrNull() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            return null;
        }
        return tenantPublicLookupService.requireTenantId(tenantCode);
    }
}
