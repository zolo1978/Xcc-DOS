package com.xccdos.prolog.multitenancy;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

@Component
public class SchemaCurrentTenantIdentifierResolver implements CurrentTenantIdentifierResolver<String> {

    @Override
    public String resolveCurrentTenantIdentifier() {
        return TenantContext.getCurrentTenantSchema();
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
