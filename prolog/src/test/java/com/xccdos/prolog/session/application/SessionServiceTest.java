package com.xccdos.prolog.session.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.session.domain.SessionStatus;
import com.xccdos.prolog.session.domain.UserSessionEntity;
import com.xccdos.prolog.session.domain.UserSessionRepository;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock
    private UserSessionRepository userSessionRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Mock
    private TenantPublicLookupService tenantPublicLookupService;

    private SessionService sessionService;

    @BeforeEach
    void setUp() {
        sessionService = new SessionService(
                userSessionRepository,
                snowflakeIdGenerator,
                tenantPublicLookupService,
                Clock.fixed(Instant.parse("2026-06-17T10:00:00Z"), ZoneOffset.UTC)
        );
    }

    @Test
    void reconnectMarksExpiredSessionAsTimeout() {
        UserSessionEntity entity = new UserSessionEntity();
        entity.setId(11L);
        entity.setSessionId("session-1");
        entity.setExpireTime(OffsetDateTime.parse("2026-06-17T09:20:00Z"));
        entity.setLastActiveTime(OffsetDateTime.parse("2026-06-17T09:00:00Z"));
        entity.setSessionStatus(SessionStatus.NORMAL);

        when(userSessionRepository.findBySessionIdAndDeleteFlag("session-1", (short) 0)).thenReturn(Optional.of(entity));
        when(userSessionRepository.save(any(UserSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = sessionService.reconnect("session-1");

        assertThat(response.sessionStatus()).isEqualTo("timeout");
        assertThat(response.expireTime()).isEqualTo("2026-06-17T09:20Z");
    }
}
