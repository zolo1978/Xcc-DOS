package com.xccdos.prolog.rule.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.rule.domain.RulePrologEntity;
import com.xccdos.prolog.rule.domain.RuleRepository;
import com.xccdos.prolog.rule.domain.RuleStatus;
import com.xccdos.prolog.rule.web.CreateRuleRequest;
import com.xccdos.prolog.rule.web.UpdateRuleStatusRequest;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
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
    private TenantRepository tenantRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @InjectMocks
    private RuleService ruleService;

    @Test
    void createRuleDefaultsToDraftAndVersionOne() {
        TenantEntity tenant = new TenantEntity();
        tenant.setId(2001L);
        when(snowflakeIdGenerator.nextId()).thenReturn(3001L);
        when(tenantRepository.findByTenantCode("acme")).thenReturn(Optional.of(tenant));
        when(ruleRepository.save(any(RulePrologEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = ruleService.createRule("acme", new CreateRuleRequest(
                "rule_1", "Rule 1", "valid(rule_1).", "process", null, null
        ));

        assertThat(response.status()).isEqualTo("draft");
        assertThat(response.version()).isEqualTo(1);
        assertThat(response.id()).isEqualTo("3001");
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
}
