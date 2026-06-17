package com.xccdos.prolog.log.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.log.domain.RequestLogEntity;
import com.xccdos.prolog.log.domain.RequestLogRepository;
import com.xccdos.prolog.log.domain.RequestStatus;
import com.xccdos.prolog.log.web.CreateRequestLogRequest;
import com.xccdos.prolog.log.web.RequestLogResponse;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequestLogService {

    private static final int MAX_CONTENT_LENGTH = 256;

    private final RequestLogRepository requestLogRepository;
    private final SnowflakeIdGenerator idGenerator;
    private final TenantPublicLookupService tenantPublicLookupService;

    public RequestLogService(
            RequestLogRepository requestLogRepository,
            SnowflakeIdGenerator idGenerator,
            TenantPublicLookupService tenantPublicLookupService
    ) {
        this.requestLogRepository = requestLogRepository;
        this.idGenerator = idGenerator;
        this.tenantPublicLookupService = tenantPublicLookupService;
    }

    @Transactional
    public RequestLogResponse record(CreateRequestLogRequest request) {
        RequestLogEntity entity = new RequestLogEntity();
        entity.setId(idGenerator.nextId());
        entity.setSessionId(request.sessionId());
        entity.setRequestUuid(request.requestUuid());
        entity.setRequestType(request.requestType());
        entity.setRequestContent(maskAndTrim(request.requestContent()));
        entity.setResponseContent(maskAndTrim(request.responseContent()));
        entity.setRuleId(parseNullableLong(request.ruleId()));
        entity.setRequestStatus(RequestStatus.fromApiValue(request.requestStatus()));
        entity.setCostTime(request.costTime());
        entity.setRequestIp(request.requestIp());
        entity.setIsSample(request.sample() ? (short) 1 : 0);
        entity.setTenantId(currentTenantIdOrNull());
        return RequestLogResponse.fromEntity(requestLogRepository.save(entity));
    }

    private String maskAndTrim(String content) {
        if (content == null || content.isBlank()) {
            return content;
        }
        String masked = content
                .replaceAll("(?i)(\"?(?:password|pwd|pass|secret)\"?\\s*[:=]\\s*\")([^\"]*)(\")", "$1***$3")
                .replaceAll("(?<!\\d)1\\d{10}(?!\\d)", "***********")
                .replaceAll("(?<![0-9A-Za-z])[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx](?![0-9A-Za-z])", "******************")
                .replaceAll("(?i)(password|pwd|pass|secret)\\s*=\\s*([^,\\s]+)", "$1=***");
        return masked.length() <= MAX_CONTENT_LENGTH ? masked : masked.substring(0, MAX_CONTENT_LENGTH);
    }

    private Long parseNullableLong(String value) {
        return value == null || value.isBlank() ? null : Long.parseLong(value);
    }

    private Long currentTenantIdOrNull() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            return null;
        }
        return tenantPublicLookupService.requireTenantId(tenantCode);
    }
}
