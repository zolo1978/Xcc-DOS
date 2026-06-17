package com.xccdos.prolog.log.web;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.log.application.RequestLogService;
import com.xccdos.prolog.multitenancy.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/request-logs")
public class RequestLogController {

    private final RequestLogService requestLogService;

    public RequestLogController(RequestLogService requestLogService) {
        this.requestLogService = requestLogService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RequestLogResponse create(@Valid @RequestBody CreateRequestLogRequest request) {
        requiredTenantCode();
        return requestLogService.record(request);
    }

    private void requiredTenantCode() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_REQUIRED", "Tenant context is required");
        }
    }
}
