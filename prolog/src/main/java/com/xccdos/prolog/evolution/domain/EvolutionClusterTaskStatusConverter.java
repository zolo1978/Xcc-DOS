package com.xccdos.prolog.evolution.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class EvolutionClusterTaskStatusConverter implements AttributeConverter<EvolutionClusterTaskStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(EvolutionClusterTaskStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public EvolutionClusterTaskStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : EvolutionClusterTaskStatus.fromCode(dbData);
    }
}
