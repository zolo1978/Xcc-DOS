package com.xccdos.prolog.tenant.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TenantIsolationTypeConverter implements AttributeConverter<TenantIsolationType, Short> {

    @Override
    public Short convertToDatabaseColumn(TenantIsolationType attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public TenantIsolationType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : TenantIsolationType.fromCode(dbData);
    }
}
