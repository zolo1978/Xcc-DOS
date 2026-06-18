package com.xccdos.prolog.common.llm;

import java.util.Map;

public interface LangflowGatewayPort {

    FlowResult runFlow(String flowId, Map<String, Object> inputs);

    record FlowResult(String output, String runId) {
    }
}
