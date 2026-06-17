package com.xccdos.prolog.tenant.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TenantDbStatusConverter implements AttributeConverter<TenantDbStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(TenantDbStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public TenantDbStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : TenantDbStatus.fromCode(dbData);
    }
}
