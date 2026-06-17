package com.xccdos.prolog.log.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RequestStatusConverter implements AttributeConverter<RequestStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(RequestStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public RequestStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : RequestStatus.fromCode(dbData);
    }
}
