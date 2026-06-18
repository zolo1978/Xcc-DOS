package com.xccdos.prolog.common.llm;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "prolog.langflow")
public record LangflowProperties(
        String baseUrl,
        String apiKey
) {
}
