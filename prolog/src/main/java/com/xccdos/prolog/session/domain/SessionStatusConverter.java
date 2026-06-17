package com.xccdos.prolog.session.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class SessionStatusConverter implements AttributeConverter<SessionStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(SessionStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public SessionStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : SessionStatus.fromCode(dbData);
    }
}
