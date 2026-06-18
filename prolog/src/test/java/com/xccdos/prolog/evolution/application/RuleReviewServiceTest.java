package com.xccdos.prolog.evolution.application;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleReviewServiceTest {

    @Mock
    private GeneratedRuleRepository generatedRuleRepository;

    @Mock
    private RuleRepository ruleRepository;

    @Mock
    private RuleSnapshotRepository ruleSnapshotRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleReviewService ruleReviewService;

    @Test
    void approvePromotesGeneratedRuleIntoDraftFormalRule() {
        GeneratedRuleEntity generatedRule = generatedRule(
                7001L,
                "{\"ruleName\":\"退款规则\",\"ruleCode\":\"ai_refund_rule\",\"ruleType\":\"process\",\"ruleContent\":\"refund_rule(User).\",\"confidence\":0.92}"
        );

        when(generatedRuleRepository.findById(7001L)).thenReturn(Optional.of(generatedRule));
        when(ruleRepository.existsByRuleCode("ai_refund_rule")).thenReturn(false);
        when(snowflakeIdGenerator.nextId()).thenReturn(8001L, 8002L);
        when(ruleRepository.save(any(RulePrologEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ruleSnapshotRepository.save(any(RuleSnapshotEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(generatedRuleRepository.save(any(GeneratedRuleEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ruleReviewService.approve(7001L, "reviewer-a");

        ArgumentCaptor<RulePrologEntity> ruleCaptor = ArgumentCaptor.forClass(RulePrologEntity.class);
        verify(ruleRepository).save(ruleCaptor.capture());
        assertThat(ruleCaptor.getValue().getId()).isEqualTo(8001L);
        assertThat(ruleCaptor.getValue().getRuleCode()).isEqualTo("ai_refund_rule");
        assertThat(ruleCaptor.getValue().getRuleName()).isEqualTo("退款规则");
        assertThat(ruleCaptor.getValue().getRuleType()).isEqualTo(RuleType.PROCESS);
        assertThat(ruleCaptor.getValue().getStatus()).isEqualTo(RuleStatus.DRAFT);
        assertThat(ruleCaptor.getValue().getVersion()).isEqualTo(1);
        assertThat(ruleCaptor.getValue().getGrayRate()).isEqualTo(100);
        assertThat(ruleCaptor.getValue().getIsAutoGen()).isEqualTo((short) 1);
        assertThat(ruleCaptor.getValue().getTenantId()).isEqualTo(2001L);

        ArgumentCaptor<GeneratedRuleEntity> generatedCaptor = ArgumentCaptor.forClass(GeneratedRuleEntity.class);
        verify(generatedRuleRepository).save(generatedCaptor.capture());
        assertThat(generatedCaptor.getValue().getReviewStatus()).isEqualTo(GeneratedRuleReviewStatus.APPROVED);
        assertThat(generatedCaptor.getValue().getReviewedBy()).isEqualTo("reviewer-a");
    }

    @Test
    void rejectMarksCandidateRejectedWithoutCreatingFormalRule() {
        GeneratedRuleEntity generatedRule = generatedRule(
                7001L,
                "{\"ruleName\":\"退款规则\",\"ruleCode\":\"ai_refund_rule\",\"ruleType\":\"process\",\"ruleContent\":\"refund_rule(User).\",\"confidence\":0.92}"
        );

        when(generatedRuleRepository.findById(7001L)).thenReturn(Optional.of(generatedRule));
        when(generatedRuleRepository.save(any(GeneratedRuleEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ruleReviewService.reject(7001L, "reviewer-b", "命中条件不清晰");

        ArgumentCaptor<GeneratedRuleEntity> generatedCaptor = ArgumentCaptor.forClass(GeneratedRuleEntity.class);
        verify(generatedRuleRepository).save(generatedCaptor.capture());
        assertThat(generatedCaptor.getValue().getReviewStatus()).isEqualTo(GeneratedRuleReviewStatus.REJECTED);
        assertThat(generatedCaptor.getValue().getReviewedBy()).isEqualTo("reviewer-b");
        assertThat(generatedCaptor.getValue().getReviewComment()).isEqualTo("命中条件不清晰");
        verify(ruleRepository, never()).save(any(RulePrologEntity.class));
    }

    private GeneratedRuleEntity generatedRule(Long id, String ruleContent) {
        GeneratedRuleEntity entity = new GeneratedRuleEntity();
        entity.setId(id);
        entity.setSourceClusterId(1101L);
        entity.setRuleContent(ruleContent);
        entity.setConfidence("0.92");
        entity.setReviewStatus(GeneratedRuleReviewStatus.PENDING_REVIEW);
        entity.setLangflowRunId("generation-run-1");
        entity.setTenantId(2001L);
        return entity;
    }
}
