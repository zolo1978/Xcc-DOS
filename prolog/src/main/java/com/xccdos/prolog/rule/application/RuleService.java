package com.xccdos.prolog.rule.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.rule.domain.RulePrologEntity;
import com.xccdos.prolog.rule.domain.RuleRepository;
import com.xccdos.prolog.rule.domain.RuleStatus;
import com.xccdos.prolog.rule.domain.RuleType;
import com.xccdos.prolog.rule.web.CreateRuleRequest;
import com.xccdos.prolog.rule.web.RuleResponse;
import com.xccdos.prolog.rule.web.UpdateGrayRateRequest;
import com.xccdos.prolog.rule.web.UpdateRuleRequest;
import com.xccdos.prolog.rule.web.UpdateRuleStatusRequest;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RuleService {

    private final RuleRepository ruleRepository;
    private final TenantRepository tenantRepository;
    private final SnowflakeIdGenerator idGenerator;

    public RuleService(RuleRepository ruleRepository, TenantRepository tenantRepository, SnowflakeIdGenerator idGenerator) {
        this.ruleRepository = ruleRepository;
        this.tenantRepository = tenantRepository;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public RuleResponse createRule(String tenantCode, CreateRuleRequest request) {
        if (ruleRepository.existsByRuleCode(request.ruleCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "RULE_CODE_EXISTS", "Rule code already exists");
        }
        TenantEntity tenant = tenantRepository.findByTenantCode(tenantCode)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "TENANT_NOT_FOUND", "Tenant not found"));
        RulePrologEntity entity = new RulePrologEntity();
        entity.setId(idGenerator.nextId());
        entity.setRuleCode(request.ruleCode());
        entity.setRuleName(request.ruleName());
        entity.setRuleContent(request.ruleContent());
        entity.setRuleType(RuleType.fromApiValue(request.ruleType()));
        entity.setParentId(parseNullableLong(request.parentRuleId()));
        entity.setStatus(RuleStatus.DRAFT);
        entity.setVersion(1);
        entity.setGrayRate(request.grayRate() == null ? 100 : request.grayRate());
        entity.setIsAutoGen((short) 0);
        entity.setTenantId(tenant.getId());
        return RuleResponse.fromEntity(ruleRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<RuleResponse> listRules(String ruleType, String status, String keyword) {
        Specification<RulePrologEntity> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (ruleType != null) {
                predicates.add(builder.equal(root.get("ruleType"), RuleType.fromApiValue(ruleType)));
            }
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), RuleStatus.fromApiValue(status)));
            }
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase() + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("ruleCode")), pattern),
                        builder.like(builder.lower(root.get("ruleName")), pattern)
                ));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return ruleRepository.findAll(specification).stream().map(RuleResponse::fromEntity).toList();
    }

    @Transactional
    public RuleResponse updateRule(Long ruleId, UpdateRuleRequest request) {
        RulePrologEntity entity = getRule(ruleId);
        entity.setRuleCode(request.ruleCode());
        entity.setRuleName(request.ruleName());
        entity.setRuleContent(request.ruleContent());
        entity.setRuleType(RuleType.fromApiValue(request.ruleType()));
        entity.setParentId(parseNullableLong(request.parentRuleId()));
        entity.setVersion(entity.getVersion() + 1);
        return RuleResponse.fromEntity(ruleRepository.save(entity));
    }

    @Transactional
    public RuleResponse updateStatus(Long ruleId, UpdateRuleStatusRequest request) {
        RulePrologEntity entity = getRule(ruleId);
        RuleStatus target = RuleStatus.fromApiValue(request.status());
        if (!isTransitionAllowed(entity.getStatus(), target)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RULE_STATUS_INVALID", "Invalid rule status transition");
        }
        entity.setStatus(target);
        return RuleResponse.fromEntity(ruleRepository.save(entity));
    }

    @Transactional
    public RuleResponse updateGrayRate(Long ruleId, UpdateGrayRateRequest request) {
        if (request.grayRate() < 0 || request.grayRate() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RULE_GRAY_RATE_INVALID", "Gray rate must be between 0 and 100");
        }
        RulePrologEntity entity = getRule(ruleId);
        entity.setGrayRate(request.grayRate());
        return RuleResponse.fromEntity(ruleRepository.save(entity));
    }

    private RulePrologEntity getRule(Long ruleId) {
        return ruleRepository.findById(ruleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RULE_NOT_FOUND", "Rule not found"));
    }

    private boolean isTransitionAllowed(RuleStatus current, RuleStatus target) {
        if (current == target) {
            return true;
        }
        return switch (current) {
            case DRAFT -> target == RuleStatus.ACTIVE;
            case ACTIVE -> target == RuleStatus.GRAY;
            case GRAY -> target == RuleStatus.INACTIVE;
            case INACTIVE -> false;
        };
    }

    private Long parseNullableLong(String value) {
        return value == null || value.isBlank() ? null : Long.parseLong(value);
    }
}
