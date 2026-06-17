package com.xccdos.prolog.rule.web;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.api.ListResponse;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.rule.application.RuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/rules")
public class RuleController {

    private final RuleService ruleService;

    public RuleController(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RuleResponse createRule(@Valid @RequestBody CreateRuleRequest request) {
        return ruleService.createRule(requiredTenantCode(), request);
    }

    @GetMapping
    public ListResponse<RuleResponse> listRules(
            @RequestParam(required = false, name = "rule_type") String ruleType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword
    ) {
        return new ListResponse<>(ruleService.listRules(ruleType, status, keyword));
    }

    @PutMapping("/{ruleId}")
    public RuleResponse updateRule(@PathVariable Long ruleId, @Valid @RequestBody UpdateRuleRequest request) {
        return ruleService.updateRule(ruleId, request);
    }

    @PatchMapping("/{ruleId}/status")
    public RuleResponse updateStatus(@PathVariable Long ruleId, @Valid @RequestBody UpdateRuleStatusRequest request) {
        return ruleService.updateStatus(ruleId, request);
    }

    @PatchMapping("/{ruleId}/gray-rate")
    public RuleResponse updateGrayRate(@PathVariable Long ruleId, @Valid @RequestBody UpdateGrayRateRequest request) {
        return ruleService.updateGrayRate(ruleId, request);
    }

    private String requiredTenantCode() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_REQUIRED", "Tenant context is required");
        }
        return tenantCode;
    }
}
