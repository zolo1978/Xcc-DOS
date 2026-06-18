package com.xccdos.prolog.common.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.api.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;

public class MockLangflowAdapter implements LangflowGatewayPort {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public FlowResult runFlow(String flowId, Map<String, Object> inputs) {
        if (flowId.contains("cluster")) {
            return new FlowResult(clusterOutput(inputs), "mock-cluster-run");
        }
        if (flowId.contains("generation")) {
            return new FlowResult(generationOutput(inputs), "mock-generation-run");
        }
        return new FlowResult("{\"message\":\"mock\"}", "mock-run");
    }

    private String clusterOutput(Map<String, Object> inputs) {
        List<String> samples = extractSamples(inputs);
        Map<String, Object> cluster = new LinkedHashMap<>();
        cluster.put("clusterKey", samples.isEmpty() ? "empty-cluster" : "cluster-" + Math.abs(samples.hashCode()));
        cluster.put("samples", samples);
        return toJson(Map.of("clusters", List.of(cluster)));
    }

    private String generationOutput(Map<String, Object> inputs) {
        String clusterKey = String.valueOf(inputs.getOrDefault("clusterKey", "cluster"));
        String normalizedKey = clusterKey.replaceAll("[^a-zA-Z0-9]+", "_").toLowerCase();
        return toJson(Map.of(
                "ruleName", "AI规则-" + clusterKey,
                "ruleCode", "ai_" + normalizedKey,
                "ruleType", "process",
                "ruleContent", normalizedKey + "_rule(User).",
                "confidence", "0.91"
        ));
    }

    @SuppressWarnings("unchecked")
    private List<String> extractSamples(Map<String, Object> inputs) {
        Object samples = inputs.get("samples");
        if (samples instanceof List<?> sampleList) {
            return sampleList.stream().map(String::valueOf).collect(Collectors.toList());
        }
        return List.of();
    }

    private String toJson(Map<String, Object> content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "LANGFLOW_MOCK_SERIALIZE_FAILED", "Mock Langflow serialization failed");
        }
    }
}
