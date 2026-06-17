package com.xccdos.prolog.synonym.web;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.api.ListResponse;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.synonym.application.SynonymService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/synonyms")
public class SynonymController {

    private final SynonymService synonymService;

    public SynonymController(SynonymService synonymService) {
        this.synonymService = synonymService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SynonymResponse createSynonym(@Valid @RequestBody CreateSynonymRequest request) {
        requiredTenantCode();
        return synonymService.createSynonym(request);
    }

    @GetMapping
    public ListResponse<SynonymResponse> listSynonyms(
            @RequestParam(required = false) String originWord,
            @RequestParam(required = false) String status
    ) {
        requiredTenantCode();
        return new ListResponse<>(synonymService.listSynonyms(originWord, status));
    }

    @PutMapping("/{synonymId}")
    public SynonymResponse updateSynonym(@PathVariable Long synonymId, @Valid @RequestBody UpdateSynonymRequest request) {
        requiredTenantCode();
        return synonymService.updateSynonym(synonymId, request);
    }

    @PatchMapping("/{synonymId}/status")
    public SynonymResponse updateStatus(@PathVariable Long synonymId, @Valid @RequestBody UpdateSynonymStatusRequest request) {
        requiredTenantCode();
        return synonymService.updateStatus(synonymId, request);
    }

    @DeleteMapping("/{synonymId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSynonym(@PathVariable Long synonymId) {
        requiredTenantCode();
        synonymService.deleteSynonym(synonymId);
    }

    private void requiredTenantCode() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_REQUIRED", "Tenant context is required");
        }
    }
}
