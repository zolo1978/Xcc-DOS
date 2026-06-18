package com.xccdos.prolog.evolution.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class EvolutionClusterTriggerTypeConverter implements AttributeConverter<EvolutionClusterTriggerType, Short> {

    @Override
    public Short convertToDatabaseColumn(EvolutionClusterTriggerType attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public EvolutionClusterTriggerType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : EvolutionClusterTriggerType.fromCode(dbData);
    }
}
