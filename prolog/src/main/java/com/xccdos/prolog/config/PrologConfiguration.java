package com.xccdos.prolog.config;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class PrologConfiguration {

    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}
