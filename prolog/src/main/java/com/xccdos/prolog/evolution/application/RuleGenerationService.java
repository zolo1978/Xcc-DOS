package com.xccdos.prolog.evolution.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.common.llm.LangflowGatewayPort;
import com.xccdos.prolog.evolution.config.EvolutionProperties;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskRepository;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.GeneratedRuleEntity;
import com.xccdos.prolog.evolution.domain.GeneratedRuleRepository;
import com.xccdos.prolog.evolution.domain.GeneratedRuleReviewStatus;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RuleGenerationService {

    private final EvolutionClusterTaskRepository evolutionClusterTaskRepository;
    private final GeneratedRuleRepository generatedRuleRepository;
    private final LangflowGatewayPort langflowGatewayPort;
    private final SnowflakeIdGenerator idGenerator;
    private final EvolutionProperties evolutionProperties;
    private final ObjectMapper objectMapper;

    public RuleGenerationService(
            EvolutionClusterTaskRepository evolutionClusterTaskRepository,
            GeneratedRuleRepository generatedRuleRepository,
            LangflowGatewayPort langflowGatewayPort,
            SnowflakeIdGenerator idGenerator,
            EvolutionProperties evolutionProperties,
            ObjectMapper objectMapper
    ) {
        this.evolutionClusterTaskRepository = evolutionClusterTaskRepository;
        this.generatedRuleRepository = generatedRuleRepository;
        this.langflowGatewayPort = langflowGatewayPort;
        this.idGenerator = idGenerator;
        this.evolutionProperties = evolutionProperties;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public GeneratedRuleEntity generateFromCluster(Long clusterTaskId) {
        EvolutionClusterTaskEntity clusterTask = evolutionClusterTaskRepository.findById(clusterTaskId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CLUSTER_TASK_NOT_FOUND", "Cluster task not found"));
        if (clusterTask.getStatus() != EvolutionClusterTaskStatus.DONE) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "CLUSTER_TASK_NOT_READY", "Cluster task is not ready for rule generation");
        }
        JsonNode clusterResult = readJson(clusterTask.getClusterResult(), "CLUSTER_RESULT_INVALID");
        Map<String, Object> inputs = new LinkedHashMap<>();
        inputs.put("clusterTaskId", clusterTask.getId());
        inputs.put("clusterKey", clusterResult.path("clusters").path(0).path("clusterKey").asText("cluster"));
        inputs.put("samples", clusterResult.path("clusters").path(0).path("samples"));

        LangflowGatewayPort.FlowResult flowResult = langflowGatewayPort.runFlow(evolutionProperties.getRuleGenerationFlowId(), inputs);
        JsonNode output = readJson(flowResult.output(), "GENERATED_RULE_INVALID");

        GeneratedRuleEntity entity = new GeneratedRuleEntity();
        entity.setId(idGenerator.nextId());
        entity.setSourceClusterId(clusterTask.getId());
        entity.setRuleContent(flowResult.output());
        entity.setConfidence(output.path("confidence").asText(null));
        entity.setReviewStatus(GeneratedRuleReviewStatus.PENDING_REVIEW);
        entity.setLangflowRunId(flowResult.runId());
        entity.setTenantId(clusterTask.getTenantId());
        return generatedRuleRepository.save(entity);
    }

    private JsonNode readJson(String content, String errorCode) {
        try {
            return objectMapper.readTree(content);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, errorCode, "Langflow returned invalid JSON");
        }
    }
}
