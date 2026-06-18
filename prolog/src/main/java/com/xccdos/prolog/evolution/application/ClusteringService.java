package com.xccdos.prolog.evolution.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.common.llm.LangflowGatewayPort;
import com.xccdos.prolog.evolution.config.EvolutionProperties;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskRepository;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;
import com.xccdos.prolog.log.domain.RequestLogEntity;
import com.xccdos.prolog.log.domain.RequestLogRepository;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClusteringService {

    private final RequestLogRepository requestLogRepository;
    private final EvolutionClusterTaskRepository evolutionClusterTaskRepository;
    private final TenantPublicLookupService tenantPublicLookupService;
    private final LangflowGatewayPort langflowGatewayPort;
    private final SnowflakeIdGenerator idGenerator;
    private final EvolutionProperties evolutionProperties;
    private final ObjectMapper objectMapper;

    public ClusteringService(
            RequestLogRepository requestLogRepository,
            EvolutionClusterTaskRepository evolutionClusterTaskRepository,
            TenantPublicLookupService tenantPublicLookupService,
            LangflowGatewayPort langflowGatewayPort,
            SnowflakeIdGenerator idGenerator,
            EvolutionProperties evolutionProperties,
            ObjectMapper objectMapper
    ) {
        this.requestLogRepository = requestLogRepository;
        this.evolutionClusterTaskRepository = evolutionClusterTaskRepository;
        this.tenantPublicLookupService = tenantPublicLookupService;
        this.langflowGatewayPort = langflowGatewayPort;
        this.idGenerator = idGenerator;
        this.evolutionProperties = evolutionProperties;
        this.objectMapper = objectMapper;
    }

    @Transactional(noRollbackFor = RuntimeException.class)
    public EvolutionClusterTaskEntity clusterTenant(String tenantCode, EvolutionClusterTriggerType triggerType) {
        TenantContext.setCurrentTenant(tenantCode, TenantSchemaNames.forTenantCode(tenantCode));
        EvolutionClusterTaskEntity task = null;
        try {
            Long tenantId = tenantPublicLookupService.requireTenantId(tenantCode);
            task = new EvolutionClusterTaskEntity();
            task.setId(idGenerator.nextId());
            task.setStatus(EvolutionClusterTaskStatus.RUNNING);
            task.setSampleCount(0);
            task.setTriggerType(triggerType);
            task.setTenantId(tenantId);
            evolutionClusterTaskRepository.save(task);

            List<RequestLogEntity> samples = requestLogRepository
                    .findTop100ByIsSampleAndDeleteFlagOrderByCreateTimeDesc((short) 1, (short) 0);
            task.setSampleCount(Math.min(samples.size(), evolutionProperties.getSampleLimit()));
            if (samples.isEmpty()) {
                task.setStatus(EvolutionClusterTaskStatus.DONE);
                task.setClusterResult("{\"clusters\":[]}");
                return evolutionClusterTaskRepository.save(task);
            }

            Map<String, Object> inputs = new LinkedHashMap<>();
            inputs.put("tenantCode", tenantCode);
            inputs.put("samples", samples.stream().limit(evolutionProperties.getSampleLimit()).map(RequestLogEntity::getRequestContent).toList());
            LangflowGatewayPort.FlowResult flowResult = langflowGatewayPort.runFlow(evolutionProperties.getClusteringFlowId(), inputs);
            validateJson(flowResult.output(), "CLUSTER_RESULT_INVALID");
            task.setClusterResult(flowResult.output());
            task.setStatus(EvolutionClusterTaskStatus.DONE);
            return evolutionClusterTaskRepository.save(task);
        } catch (RuntimeException exception) {
            if (task != null) {
                task.setStatus(EvolutionClusterTaskStatus.FAILED);
                task.setClusterResult(failurePayload(exception.getMessage()));
                evolutionClusterTaskRepository.save(task);
            }
            throw exception;
        } finally {
            TenantContext.clear();
        }
    }

    @Transactional(readOnly = true)
    public List<EvolutionClusterTaskEntity> listTasks(String tenantCode) {
        TenantContext.setCurrentTenant(tenantCode, TenantSchemaNames.forTenantCode(tenantCode));
        try {
            return evolutionClusterTaskRepository.findAllByOrderByCreateTimeDesc();
        } finally {
            TenantContext.clear();
        }
    }

    private void validateJson(String content, String errorCode) {
        try {
            objectMapper.readTree(content);
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, errorCode, "Langflow returned invalid JSON");
        }
    }

    private String failurePayload(String message) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "error", message == null || message.isBlank() ? "unknown" : message
            ));
        } catch (JsonProcessingException exception) {
            return "{\"error\":\"unknown\"}";
        }
    }
}
