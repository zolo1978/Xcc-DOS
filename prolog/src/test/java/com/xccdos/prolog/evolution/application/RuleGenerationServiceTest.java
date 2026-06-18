package com.xccdos.prolog.evolution.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.common.llm.LangflowGatewayPort;
import com.xccdos.prolog.evolution.config.EvolutionProperties;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskRepository;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.GeneratedRuleEntity;
import com.xccdos.prolog.evolution.domain.GeneratedRuleRepository;
import com.xccdos.prolog.evolution.domain.GeneratedRuleReviewStatus;
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
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleGenerationServiceTest {

    @Mock
    private EvolutionClusterTaskRepository evolutionClusterTaskRepository;

    @Mock
    private GeneratedRuleRepository generatedRuleRepository;

    @Mock
    private LangflowGatewayPort langflowGatewayPort;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Spy
    private EvolutionProperties evolutionProperties = new EvolutionProperties();

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RuleGenerationService ruleGenerationService;

    @Test
    void generateFromClusterWritesPendingReviewCandidate() {
        EvolutionClusterTaskEntity clusterTask = new EvolutionClusterTaskEntity();
        clusterTask.setId(1101L);
        clusterTask.setTenantId(2001L);
        clusterTask.setStatus(EvolutionClusterTaskStatus.DONE);
        clusterTask.setClusterResult("{\"clusters\":[{\"clusterKey\":\"refund\",\"samples\":[\"如何退款\"]}]}");

        when(evolutionClusterTaskRepository.findById(1101L)).thenReturn(Optional.of(clusterTask));
        when(snowflakeIdGenerator.nextId()).thenReturn(8101L);
        when(langflowGatewayPort.runFlow(eq("rule-generation"), anyMap()))
                .thenReturn(new LangflowGatewayPort.FlowResult(
                        "{\"ruleName\":\"退款规则\",\"ruleCode\":\"ai_refund_rule\",\"ruleType\":\"process\",\"ruleContent\":\"refund_rule(User).\",\"confidence\":0.92}",
                        "generation-run-1"
                ));
        when(generatedRuleRepository.save(any(GeneratedRuleEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ruleGenerationService.generateFromCluster(1101L);

        ArgumentCaptor<GeneratedRuleEntity> captor = ArgumentCaptor.forClass(GeneratedRuleEntity.class);
        verify(generatedRuleRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(8101L);
        assertThat(captor.getValue().getSourceClusterId()).isEqualTo(1101L);
        assertThat(captor.getValue().getReviewStatus()).isEqualTo(GeneratedRuleReviewStatus.PENDING_REVIEW);
        assertThat(captor.getValue().getConfidence()).isEqualTo("0.92");
        assertThat(captor.getValue().getLangflowRunId()).isEqualTo("generation-run-1");
        assertThat(captor.getValue().getRuleContent()).contains("\"ruleCode\":\"ai_refund_rule\"");
        assertThat(captor.getValue().getTenantId()).isEqualTo(2001L);
    }
}
