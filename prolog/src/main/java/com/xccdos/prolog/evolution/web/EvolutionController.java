package com.xccdos.prolog.evolution.web;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.api.ListResponse;
import com.xccdos.prolog.evolution.application.ClusteringService;
import com.xccdos.prolog.evolution.application.RuleGenerationService;
import com.xccdos.prolog.evolution.application.RuleReviewService;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.rule.web.RuleResponse;
import com.xccdos.prolog.security.RoleLevelAuthority;
import jakarta.validation.Valid;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/evolution")
public class EvolutionController {

    private final ClusteringService clusteringService;
    private final RuleGenerationService ruleGenerationService;
    private final RuleReviewService ruleReviewService;

    public EvolutionController(
            ClusteringService clusteringService,
            RuleGenerationService ruleGenerationService,
            RuleReviewService ruleReviewService
    ) {
        this.clusteringService = clusteringService;
        this.ruleGenerationService = ruleGenerationService;
        this.ruleReviewService = ruleReviewService;
    }

    @PostMapping("/cluster-tasks")
    public EvolutionClusterTaskResponse clusterTasks() {
        return EvolutionClusterTaskResponse.fromEntity(
                clusteringService.clusterTenant(requiredTenantCode(), EvolutionClusterTriggerType.MANUAL)
        );
    }

    @GetMapping("/cluster-tasks")
    public ListResponse<EvolutionClusterTaskResponse> listClusterTasks() {
        requiredTenantCode();
        return new ListResponse<>(clusteringService.listTasks(TenantContext.getCurrentTenantCode())
                .stream()
                .map(EvolutionClusterTaskResponse::fromEntity)
                .toList());
    }

    @PostMapping("/cluster-tasks/{id}/generate")
    public GeneratedRuleResponse generateFromCluster(@PathVariable Long id) {
        requiredTenantCode();
        return GeneratedRuleResponse.fromEntity(ruleGenerationService.generateFromCluster(id));
    }

    @GetMapping("/generated-rules")
    public ListResponse<GeneratedRuleResponse> listGeneratedRules(
            @RequestParam(required = false, defaultValue = "pending_review") String reviewStatus
    ) {
        requiredTenantCode();
        return new ListResponse<>(ruleReviewService.listGeneratedRules(reviewStatus)
                .stream()
                .map(GeneratedRuleResponse::fromEntity)
                .toList());
    }

    @PostMapping("/generated-rules/{id}/approve")
    public RuleResponse approve(@PathVariable Long id) {
        requiredTenantCode();
        requireTenantAdmin();
        return RuleResponse.fromEntity(ruleReviewService.approve(id, currentUser()));
    }

    @PostMapping("/generated-rules/{id}/reject")
    public GeneratedRuleResponse reject(@PathVariable Long id, @Valid @RequestBody RejectGeneratedRuleRequest request) {
        requiredTenantCode();
        requireTenantAdmin();
        return GeneratedRuleResponse.fromEntity(ruleReviewService.reject(id, currentUser(), request.reason()));
    }

    private String requiredTenantCode() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_REQUIRED", "Tenant context is required");
        }
        return tenantCode;
    }

    private void requireTenantAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean isTenantAdmin = authentication != null
                && authentication.getAuthorities().stream()
                .map(grantedAuthority -> grantedAuthority.getAuthority())
                .filter(Objects::nonNull)
                .anyMatch(RoleLevelAuthority.TENANT_ADMIN_ROLE::equals);
        if (!isTenantAdmin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Forbidden");
        }
    }

    private String currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null || authentication.getName() == null ? "system" : authentication.getName();
    }
}
