package com.xccdos.prolog.config;

import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JpaConfig {

    @Bean
    HibernatePropertiesCustomizer hibernatePropertiesCustomizer(
            MultiTenantConnectionProvider<String> connectionProvider,
            CurrentTenantIdentifierResolver<String> tenantIdentifierResolver
    ) {
        return properties -> {
            properties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, connectionProvider);
            properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantIdentifierResolver);
        };
    }
}
