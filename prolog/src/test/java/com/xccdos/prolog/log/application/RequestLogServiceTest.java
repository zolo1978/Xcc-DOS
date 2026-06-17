package com.xccdos.prolog.log.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.log.domain.RequestLogEntity;
import com.xccdos.prolog.log.domain.RequestLogRepository;
import com.xccdos.prolog.log.web.CreateRequestLogRequest;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RequestLogServiceTest {

    @Mock
    private RequestLogRepository requestLogRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Mock
    private TenantPublicLookupService tenantPublicLookupService;

    @InjectMocks
    private RequestLogService requestLogService;

    @Test
    void recordRequestMasksSensitiveContentAndTruncatesTo256() {
        when(snowflakeIdGenerator.nextId()).thenReturn(1001L);
        when(requestLogRepository.save(any(RequestLogEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        requestLogService.record(new CreateRequestLogRequest(
                "session-1",
                "req-1",
                "chat",
                "{\"password\":\"secret\",\"mobile\":\"13812345678\",\"idCard\":\"110101199003071234\"}" + "x".repeat(300),
                "{\"pwd\":\"abc123\"}",
                "11",
                "success",
                18L,
                "10.0.0.1",
                true
        ));

        ArgumentCaptor<RequestLogEntity> captor = ArgumentCaptor.forClass(RequestLogEntity.class);
        verify(requestLogRepository).save(captor.capture());
        assertThat(captor.getValue().getRequestContent()).doesNotContain("13812345678");
        assertThat(captor.getValue().getRequestContent()).doesNotContain("110101199003071234");
        assertThat(captor.getValue().getRequestContent()).doesNotContain("secret");
        assertThat(captor.getValue().getRequestContent().length()).isLessThanOrEqualTo(256);
        assertThat(captor.getValue().getResponseContent()).doesNotContain("abc123");
    }
}
