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
import com.xccdos.prolog.rule.web.RollbackRuleRequest;
import com.xccdos.prolog.rule.web.UpdateRuleStatusRequest;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleServiceTest {

    @Mock
    private RuleRepository ruleRepository;

    @Mock
    private TenantPublicLookupService tenantPublicLookupService;

    @Mock
    private RuleSnapshotRepository ruleSnapshotRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @InjectMocks
    private RuleService ruleService;

    @Test
    void createRuleDefaultsToDraftAndVersionOne() {
        when(snowflakeIdGenerator.nextId()).thenReturn(3001L, 3002L);
        when(tenantPublicLookupService.requireTenantId("acme")).thenReturn(2001L);
        when(ruleRepository.save(any(RulePrologEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ruleSnapshotRepository.save(any(RuleSnapshotEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ruleService.createRule("acme", new CreateRuleRequest(
                "rule_1", "Rule 1", "valid(rule_1).", "process", null, null
        ));

        assertThat(response.status()).isEqualTo("draft");
        assertThat(response.version()).isEqualTo(1);
        assertThat(response.id()).isEqualTo("3001");
    }

    @Test
    void publishGrayRejectsInvalidRate() {
        assertThatThrownBy(() -> ruleService.publishGray(11L, new PublishGrayRuleRequest(101)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateStatusRejectsSkippedLifecycleTransition() {
        RulePrologEntity entity = new RulePrologEntity();
        entity.setId(11L);
        entity.setStatus(RuleStatus.DRAFT);
        when(ruleRepository.findById(11L)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> ruleService.updateStatus(11L, new UpdateRuleStatusRequest("gray")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rollbackRestoresSnapshotContentAndCreatesNextVersion() {
        RulePrologEntity entity = new RulePrologEntity();
        entity.setId(11L);
        entity.setRuleCode("rule_1");
        entity.setRuleName("Rule 1");
        entity.setRuleContent("current(v3).");
        entity.setRuleType(RuleType.PROCESS);
        entity.setStatus(RuleStatus.ACTIVE);
        entity.setVersion(3);
        entity.setGrayRate(100);

        RuleSnapshotEntity snapshot = new RuleSnapshotEntity();
        snapshot.setId(21L);
        snapshot.setRuleId(11L);
        snapshot.setRuleContent("previous(v2).");
        snapshot.setVersion(2);

        when(ruleRepository.findById(11L)).thenReturn(Optional.of(entity));
        when(ruleSnapshotRepository.findByRuleIdAndVersion(11L, 2)).thenReturn(Optional.of(snapshot));
        when(ruleRepository.save(any(RulePrologEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ruleSnapshotRepository.save(any(RuleSnapshotEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(snowflakeIdGenerator.nextId()).thenReturn(1001L);

        var response = ruleService.rollback(11L, new RollbackRuleRequest(2));

        assertThat(response.ruleContent()).isEqualTo("previous(v2).");
        assertThat(response.ruleType()).isEqualTo("process");
        assertThat(response.version()).isEqualTo(4);
    }
}
