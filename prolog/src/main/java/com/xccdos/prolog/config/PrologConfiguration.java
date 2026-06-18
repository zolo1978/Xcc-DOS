package com.xccdos.prolog.config;

import java.time.Clock;
import com.xccdos.prolog.common.llm.LangflowProperties;
import com.xccdos.prolog.evolution.config.EvolutionProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({JwtProperties.class, LangflowProperties.class, EvolutionProperties.class})
public class PrologConfiguration {

    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}
