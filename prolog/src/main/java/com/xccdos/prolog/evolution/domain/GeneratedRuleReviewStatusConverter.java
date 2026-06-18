package com.xccdos.prolog.evolution.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class GeneratedRuleReviewStatusConverter implements AttributeConverter<GeneratedRuleReviewStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(GeneratedRuleReviewStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public GeneratedRuleReviewStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : GeneratedRuleReviewStatus.fromCode(dbData);
    }
}
