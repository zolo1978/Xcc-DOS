package com.xccdos.prolog.common.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.xccdos.prolog.common.api.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

public class LangflowAdapter implements LangflowGatewayPort {

    private final RestClient restClient;
    private final LangflowProperties properties;

    public LangflowAdapter(RestClient restClient, LangflowProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    @Override
    public FlowResult runFlow(String flowId, Map<String, Object> inputs) {
        Map<String, Object> payload = new LinkedHashMap<>(inputs);
        JsonNode response = restClient.post()
                .uri(UriComponentsBuilder.fromHttpUrl(properties.baseUrl())
                        .path("/api/v1/run/{flowId}")
                        .buildAndExpand(flowId)
                        .toUri())
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> applyApiKey(headers, properties.apiKey()))
                .body(payload)
                .retrieve()
                .body(JsonNode.class);
        if (response == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "LANGFLOW_EMPTY_RESPONSE", "Langflow returned empty response");
        }
        String output = extractOutput(response);
        String runId = extractRunId(response);
        return new FlowResult(output, runId);
    }

    private void applyApiKey(HttpHeaders headers, String apiKey) {
        if (apiKey != null && !apiKey.isBlank()) {
            headers.setBearerAuth(apiKey);
        }
    }

    private String extractOutput(JsonNode response) {
        if (response.hasNonNull("output")) {
            JsonNode output = response.get("output");
            return output.isTextual() ? output.asText() : output.toString();
        }
        if (response.hasNonNull("result")) {
            JsonNode result = response.get("result");
            return result.isTextual() ? result.asText() : result.toString();
        }
        if (response.hasNonNull("outputs")) {
            JsonNode textResult = response.at("/outputs/0/outputs/0/results/text/data/text");
            if (!textResult.isMissingNode() && !textResult.isNull()) {
                return textResult.asText();
            }
            JsonNode messageResult = response.at("/outputs/0/outputs/0/results/message/text");
            if (!messageResult.isMissingNode() && !messageResult.isNull()) {
                return messageResult.asText();
            }
            JsonNode artifactResult = response.at("/outputs/0/outputs/0/artifacts/message");
            if (!artifactResult.isMissingNode() && !artifactResult.isNull()) {
                return artifactResult.isTextual() ? artifactResult.asText() : artifactResult.toString();
            }
            return response.get("outputs").toString();
        }
        return response.toString();
    }

    private String extractRunId(JsonNode response) {
        if (response.hasNonNull("run_id")) {
            return response.get("run_id").asText();
        }
        if (response.hasNonNull("runId")) {
            return response.get("runId").asText();
        }
        if (response.hasNonNull("id")) {
            return response.get("id").asText();
        }
        if (response.hasNonNull("session_id")) {
            return response.get("session_id").asText();
        }
        return "";
    }
}
