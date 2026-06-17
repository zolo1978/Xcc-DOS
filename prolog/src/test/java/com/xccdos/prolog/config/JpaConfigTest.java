package com.xccdos.prolog.config;

import java.util.HashMap;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class JpaConfigTest {

    @Test
    void hibernatePropertiesCustomizerRegistersHibernate6MultitenancyBeansOnly() {
        @SuppressWarnings("unchecked")
        MultiTenantConnectionProvider<String> connectionProvider = mock(MultiTenantConnectionProvider.class);
        @SuppressWarnings("unchecked")
        CurrentTenantIdentifierResolver<String> tenantIdentifierResolver = mock(CurrentTenantIdentifierResolver.class);
        var properties = new HashMap<String, Object>();

        new JpaConfig()
                .hibernatePropertiesCustomizer(connectionProvider, tenantIdentifierResolver)
                .customize(properties);

        assertThat(properties)
                .containsEntry(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, connectionProvider)
                .containsEntry(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantIdentifierResolver)
                .hasSize(2);
    }
}
