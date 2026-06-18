package com.xccdos.prolog.common.llm;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class LangflowConfiguration {

    @Bean
    public LangflowGatewayPort langflowGatewayPort(RestClient.Builder restClientBuilder, LangflowProperties properties) {
        if (properties.baseUrl() == null || properties.baseUrl().isBlank()) {
            return new MockLangflowAdapter();
        }
        return new LangflowAdapter(restClientBuilder.build(), properties);
    }
}
