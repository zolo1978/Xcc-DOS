package com.xccdos.prolog.session.web;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.session.application.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse createSession(@RequestBody CreateSessionRequest request) {
        requiredTenantCode();
        return sessionService.createSession(request.userIp(), request.currentState(), request.contextData());
    }

    @GetMapping("/{sessionId}")
    public SessionResponse getSession(@PathVariable String sessionId) {
        requiredTenantCode();
        return sessionService.getSession(sessionId);
    }

    @PatchMapping("/{sessionId}/reconnect")
    public SessionResponse reconnect(@PathVariable String sessionId) {
        requiredTenantCode();
        return sessionService.reconnect(sessionId);
    }

    @PutMapping("/{sessionId}/context")
    public SessionResponse updateContext(@PathVariable String sessionId, @Valid @RequestBody UpdateSessionContextRequest request) {
        requiredTenantCode();
        return sessionService.updateContext(sessionId, request);
    }

    @PatchMapping("/{sessionId}/logout")
    public SessionResponse logout(@PathVariable String sessionId) {
        requiredTenantCode();
        return sessionService.logout(sessionId);
    }

    private void requiredTenantCode() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_REQUIRED", "Tenant context is required");
        }
    }
}
