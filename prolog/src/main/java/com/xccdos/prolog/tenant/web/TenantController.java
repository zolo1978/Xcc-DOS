package com.xccdos.prolog.tenant.web;

import com.xccdos.prolog.common.api.ListResponse;
import com.xccdos.prolog.tenant.application.TenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TenantResponse createTenant(@Valid @RequestBody CreateTenantRequest request) {
        return tenantService.createTenant(request);
    }

    @GetMapping
    public ListResponse<TenantResponse> listTenants(@RequestParam(required = false) String status) {
        return new ListResponse<>(tenantService.listTenants(status));
    }

    @PatchMapping("/{tenantId}/status")
    public TenantResponse updateStatus(
            @PathVariable Long tenantId,
            @Valid @RequestBody UpdateTenantStatusRequest request
    ) {
        return tenantService.updateStatus(tenantId, request.status());
    }
}
