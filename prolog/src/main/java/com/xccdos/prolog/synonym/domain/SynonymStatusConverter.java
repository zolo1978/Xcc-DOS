package com.xccdos.prolog.synonym.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class SynonymStatusConverter implements AttributeConverter<SynonymStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(SynonymStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public SynonymStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : SynonymStatus.fromCode(dbData);
    }
}
