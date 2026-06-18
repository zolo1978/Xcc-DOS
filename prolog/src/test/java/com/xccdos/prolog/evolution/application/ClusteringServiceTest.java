package com.xccdos.prolog.evolution.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.common.llm.LangflowGatewayPort;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskRepository;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;
import com.xccdos.prolog.log.domain.RequestLogEntity;
import com.xccdos.prolog.log.domain.RequestLogRepository;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.evolution.config.EvolutionProperties;
import org.junit.jupiter.api.AfterEach;
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
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClusteringServiceTest {

    @Mock
    private RequestLogRepository requestLogRepository;

    @Mock
    private EvolutionClusterTaskRepository evolutionClusterTaskRepository;

    @Mock
    private TenantPublicLookupService tenantPublicLookupService;

    @Mock
    private LangflowGatewayPort langflowGatewayPort;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Spy
    private EvolutionProperties evolutionProperties = new EvolutionProperties();

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ClusteringService clusteringService;

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void clusterTenantWritesDoneTaskWithLangflowResult() {
        when(tenantPublicLookupService.requireTenantId("acme")).thenReturn(2001L);
        when(snowflakeIdGenerator.nextId()).thenReturn(9001L);
        when(requestLogRepository.findTop100ByIsSampleAndDeleteFlagOrderByCreateTimeDesc((short) 1, (short) 0))
                .thenReturn(List.of(requestLog("如何退款"), requestLog("退款多久到账")));
        when(langflowGatewayPort.runFlow(eq("request-log-clustering"), anyMap()))
                .thenReturn(new LangflowGatewayPort.FlowResult(
                        "{\"clusters\":[{\"clusterKey\":\"refund\",\"samples\":[\"如何退款\",\"退款多久到账\"]}]}",
                        "cluster-run-1"
                ));
        when(evolutionClusterTaskRepository.save(any(EvolutionClusterTaskEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        clusteringService.clusterTenant("acme", EvolutionClusterTriggerType.MANUAL);

        ArgumentCaptor<EvolutionClusterTaskEntity> captor = ArgumentCaptor.forClass(EvolutionClusterTaskEntity.class);
        verify(evolutionClusterTaskRepository, atLeastOnce()).save(captor.capture());
        EvolutionClusterTaskEntity savedTask = captor.getAllValues().getLast();
        assertThat(savedTask.getId()).isEqualTo(9001L);
        assertThat(savedTask.getStatus()).isEqualTo(EvolutionClusterTaskStatus.DONE);
        assertThat(savedTask.getSampleCount()).isEqualTo(2);
        assertThat(savedTask.getTriggerType()).isEqualTo(EvolutionClusterTriggerType.MANUAL);
        assertThat(savedTask.getTenantId()).isEqualTo(2001L);
        assertThat(savedTask.getClusterResult()).contains("\"clusterKey\":\"refund\"");
        assertThat(TenantContext.getCurrentTenantCode()).isNull();
    }

    private RequestLogEntity requestLog(String content) {
        RequestLogEntity entity = new RequestLogEntity();
        entity.setRequestContent(content);
        return entity;
    }
}
