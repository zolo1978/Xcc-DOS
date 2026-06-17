package com.xccdos.prolog.rule.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.rule.domain.RulePrologEntity;
import com.xccdos.prolog.rule.domain.RuleRepository;
import com.xccdos.prolog.rule.domain.RuleSnapshotEntity;
import com.xccdos.prolog.rule.domain.RuleSnapshotRepository;
import com.xccdos.prolog.rule.domain.RuleStatus;
import com.xccdos.prolog.rule.domain.RuleType;
import com.xccdos.prolog.rule.web.CreateRuleRequest;
import com.xccdos.prolog.rule.web.PublishGrayRuleRequest;
import com.xccdos.prolog.rule.web.RuleResponse;
import com.xccdos.prolog.rule.web.RollbackRuleRequest;
import com.xccdos.prolog.rule.web.UpdateGrayRateRequest;
import com.xccdos.prolog.rule.web.UpdateRuleRequest;
import com.xccdos.prolog.rule.web.UpdateRuleStatusRequest;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;

@Service
public class RuleService {

    private final RuleRepository ruleRepository;
    private final RuleSnapshotRepository ruleSnapshotRepository;
    private final TenantPublicLookupService tenantPublicLookupService;
    private final SnowflakeIdGenerator idGenerator;

    public RuleService(
            RuleRepository ruleRepository,
            RuleSnapshotRepository ruleSnapshotRepository,
            TenantPublicLookupService tenantPublicLookupService,
            SnowflakeIdGenerator idGenerator
    ) {
        this.ruleRepository = ruleRepository;
        this.ruleSnapshotRepository = ruleSnapshotRepository;
        this.tenantPublicLookupService = tenantPublicLookupService;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public RuleResponse createRule(String tenantCode, CreateRuleRequest request) {
        if (ruleRepository.existsByRuleCode(request.ruleCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "RULE_CODE_EXISTS", "Rule code already exists");
        }
        if (request.grayRate() != null) {
            validateGrayRate(request.grayRate());
        }
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
        entity.setTenantId(tenantPublicLookupService.requireTenantId(tenantCode));
        RulePrologEntity saved = ruleRepository.save(entity);
        saveSnapshot(saved, "create");
        return RuleResponse.fromEntity(saved);
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
        return RuleResponse.fromEntity(saveNewVersion(entity, "update"));
    }

    @Transactional
    public RuleResponse updateStatus(Long ruleId, UpdateRuleStatusRequest request) {
        RulePrologEntity entity = getRule(ruleId);
        RuleStatus target = RuleStatus.fromApiValue(request.status());
        if (!isTransitionAllowed(entity.getStatus(), target)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RULE_STATUS_INVALID", "Invalid rule status transition");
        }
        entity.setStatus(target);
        return RuleResponse.fromEntity(saveNewVersion(entity, "status:" + target.getApiValue()));
    }

    @Transactional
    public RuleResponse updateGrayRate(Long ruleId, UpdateGrayRateRequest request) {
        RulePrologEntity entity = getRule(ruleId);
        validateGrayRate(request.grayRate());
        entity.setGrayRate(request.grayRate());
        return RuleResponse.fromEntity(ruleRepository.save(entity));
    }

    @Transactional
    public RuleResponse publishGray(Long ruleId, PublishGrayRuleRequest request) {
        validateGrayRate(request.grayRate());
        RulePrologEntity entity = getRule(ruleId);
        entity.setStatus(RuleStatus.GRAY);
        entity.setGrayRate(request.grayRate());
        return RuleResponse.fromEntity(saveNewVersion(entity, "publish-gray"));
    }

    @Transactional
    public RuleResponse fullRelease(Long ruleId) {
        RulePrologEntity entity = getRule(ruleId);
        entity.setStatus(RuleStatus.ACTIVE);
        entity.setGrayRate(100);
        return RuleResponse.fromEntity(saveNewVersion(entity, "full-release"));
    }

    @Transactional
    public RuleResponse rollback(Long ruleId, RollbackRuleRequest request) {
        RulePrologEntity entity = getRule(ruleId);
        RuleSnapshotEntity snapshot = ruleSnapshotRepository.findByRuleIdAndVersion(ruleId, request.version())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RULE_SNAPSHOT_NOT_FOUND", "Rule snapshot not found"));
        entity.setRuleContent(snapshot.getRuleContent());
        return RuleResponse.fromEntity(saveNewVersion(entity, "rollback:" + request.version()));
    }

    private RulePrologEntity getRule(Long ruleId) {
        return ruleRepository.findById(ruleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "RULE_NOT_FOUND", "Rule not found"));
    }

    private RulePrologEntity saveNewVersion(RulePrologEntity entity, String changeDesc) {
        entity.setVersion(entity.getVersion() + 1);
        RulePrologEntity saved = ruleRepository.save(entity);
        saveSnapshot(saved, changeDesc);
        return saved;
    }

    private void saveSnapshot(RulePrologEntity entity, String changeDesc) {
        RuleSnapshotEntity snapshot = new RuleSnapshotEntity();
        snapshot.setId(idGenerator.nextId());
        snapshot.setRuleId(entity.getId());
        snapshot.setRuleContent(entity.getRuleContent());
        snapshot.setVersion(entity.getVersion());
        snapshot.setChangeDesc(changeDesc);
        snapshot.setCreateUser(currentUser());
        snapshot.setTenantId(entity.getTenantId());
        ruleSnapshotRepository.save(snapshot);
    }

    private String currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null || authentication.getName() == null ? "system" : authentication.getName();
    }

    private void validateGrayRate(int grayRate) {
        if (grayRate < 0 || grayRate > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RULE_GRAY_RATE_INVALID", "Gray rate must be between 0 and 100");
        }
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
