package com.xccdos.prolog.common.llm;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

class LangflowConfigurationTest {

    private final LangflowConfiguration configuration = new LangflowConfiguration();

    @Test
    void returnsMockAdapterWhenBaseUrlIsBlank() {
        LangflowGatewayPort gatewayPort = configuration.langflowGatewayPort(
                RestClient.builder(),
                new LangflowProperties("", "secret")
        );

        assertThat(gatewayPort).isInstanceOf(MockLangflowAdapter.class);
    }

    @Test
    void returnsHttpAdapterWhenBaseUrlIsConfigured() {
        LangflowGatewayPort gatewayPort = configuration.langflowGatewayPort(
                RestClient.builder(),
                new LangflowProperties("http://langflow:7860", "secret")
        );

        assertThat(gatewayPort).isInstanceOf(LangflowAdapter.class);
    }
}
