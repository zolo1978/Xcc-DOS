package com.xccdos.prolog.evolution.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.evolution.domain.GeneratedRuleEntity;
import com.xccdos.prolog.evolution.domain.GeneratedRuleRepository;
import com.xccdos.prolog.evolution.domain.GeneratedRuleReviewStatus;
import com.xccdos.prolog.rule.domain.RulePrologEntity;
import com.xccdos.prolog.rule.domain.RuleRepository;
import com.xccdos.prolog.rule.domain.RuleSnapshotEntity;
import com.xccdos.prolog.rule.domain.RuleSnapshotRepository;
import com.xccdos.prolog.rule.domain.RuleStatus;
import com.xccdos.prolog.rule.domain.RuleType;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RuleReviewService {

    private final GeneratedRuleRepository generatedRuleRepository;
    private final RuleRepository ruleRepository;
    private final RuleSnapshotRepository ruleSnapshotRepository;
    private final SnowflakeIdGenerator idGenerator;
    private final ObjectMapper objectMapper;

    public RuleReviewService(
            GeneratedRuleRepository generatedRuleRepository,
            RuleRepository ruleRepository,
            RuleSnapshotRepository ruleSnapshotRepository,
            SnowflakeIdGenerator idGenerator,
            ObjectMapper objectMapper
    ) {
        this.generatedRuleRepository = generatedRuleRepository;
        this.ruleRepository = ruleRepository;
        this.ruleSnapshotRepository = ruleSnapshotRepository;
        this.idGenerator = idGenerator;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<GeneratedRuleEntity> listPendingReview() {
        return generatedRuleRepository.findAllByReviewStatusOrderByCreateTimeDesc(GeneratedRuleReviewStatus.PENDING_REVIEW);
    }

    @Transactional(readOnly = true)
    public List<GeneratedRuleEntity> listGeneratedRules(String reviewStatus) {
        if (reviewStatus == null || reviewStatus.isBlank()) {
            return generatedRuleRepository.findAllByOrderByCreateTimeDesc();
        }
        return generatedRuleRepository.findAllByReviewStatusOrderByCreateTimeDesc(parseReviewStatus(reviewStatus));
    }

    @Transactional
    public RulePrologEntity approve(Long generatedRuleId, String reviewer) {
        GeneratedRuleEntity generatedRule = requirePendingRule(generatedRuleId);
        JsonNode output = readJson(generatedRule.getRuleContent());

        RulePrologEntity rule = new RulePrologEntity();
        rule.setId(idGenerator.nextId());
        rule.setRuleCode(resolveRuleCode(output, generatedRuleId));
        rule.setRuleName(resolveRuleName(output, generatedRuleId));
        rule.setRuleType(resolveRuleType(output));
        rule.setRuleContent(resolveRuleContent(output, generatedRule.getRuleContent()));
        rule.setStatus(RuleStatus.DRAFT);
        rule.setVersion(1);
        rule.setGrayRate(100);
        rule.setIsAutoGen((short) 1);
        rule.setTenantId(generatedRule.getTenantId());
        RulePrologEntity savedRule = ruleRepository.save(rule);
        saveSnapshot(savedRule, reviewer);

        generatedRule.setReviewStatus(GeneratedRuleReviewStatus.APPROVED);
        generatedRule.setReviewedBy(reviewer);
        generatedRule.setReviewComment(null);
        generatedRuleRepository.save(generatedRule);
        return savedRule;
    }

    @Transactional
    public GeneratedRuleEntity reject(Long generatedRuleId, String reviewer, String reason) {
        GeneratedRuleEntity generatedRule = requirePendingRule(generatedRuleId);
        generatedRule.setReviewStatus(GeneratedRuleReviewStatus.REJECTED);
        generatedRule.setReviewedBy(reviewer);
        generatedRule.setReviewComment(reason);
        return generatedRuleRepository.save(generatedRule);
    }

    private GeneratedRuleEntity requirePendingRule(Long generatedRuleId) {
        GeneratedRuleEntity generatedRule = generatedRuleRepository.findById(generatedRuleId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GENERATED_RULE_NOT_FOUND", "Generated rule not found"));
        if (generatedRule.getReviewStatus() != GeneratedRuleReviewStatus.PENDING_REVIEW) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GENERATED_RULE_REVIEWED", "Generated rule is already reviewed");
        }
        return generatedRule;
    }

    private JsonNode readJson(String content) {
        try {
            return objectMapper.readTree(content);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GENERATED_RULE_INVALID", "Generated rule content is not valid JSON");
        }
    }

    private String resolveRuleCode(JsonNode output, Long generatedRuleId) {
        String candidate = output.path("ruleCode").asText("").trim();
        if (candidate.isBlank()) {
            candidate = "ai_rule_" + generatedRuleId;
        }
        String normalized = candidate.replaceAll("[^a-zA-Z0-9_]+", "_").toLowerCase();
        if (!ruleRepository.existsByRuleCode(normalized)) {
            return normalized;
        }
        return normalized + "_" + generatedRuleId;
    }

    private String resolveRuleName(JsonNode output, Long generatedRuleId) {
        String candidate = output.path("ruleName").asText("").trim();
        return candidate.isBlank() ? "AI Rule " + generatedRuleId : candidate;
    }

    private RuleType resolveRuleType(JsonNode output) {
        String candidate = output.path("ruleType").asText("process");
        try {
            return RuleType.fromApiValue(candidate);
        } catch (IllegalArgumentException exception) {
            return RuleType.PROCESS;
        }
    }

    private String resolveRuleContent(JsonNode output, String rawOutput) {
        String candidate = output.path("ruleContent").asText("").trim();
        return candidate.isBlank() ? rawOutput : candidate;
    }

    private void saveSnapshot(RulePrologEntity rule, String reviewer) {
        RuleSnapshotEntity snapshot = new RuleSnapshotEntity();
        snapshot.setId(idGenerator.nextId());
        snapshot.setRuleId(rule.getId());
        snapshot.setRuleContent(rule.getRuleContent());
        snapshot.setVersion(rule.getVersion());
        snapshot.setChangeDesc("approve-generated-rule");
        snapshot.setCreateUser(reviewer);
        snapshot.setTenantId(rule.getTenantId());
        ruleSnapshotRepository.save(snapshot);
    }

    private GeneratedRuleReviewStatus parseReviewStatus(String reviewStatus) {
        return switch (reviewStatus) {
            case "pending_review" -> GeneratedRuleReviewStatus.PENDING_REVIEW;
            case "approved" -> GeneratedRuleReviewStatus.APPROVED;
            case "rejected" -> GeneratedRuleReviewStatus.REJECTED;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "GENERATED_RULE_STATUS_INVALID", "Unknown review status");
        };
    }
}
