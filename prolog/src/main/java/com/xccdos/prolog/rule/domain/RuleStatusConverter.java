package com.xccdos.prolog.rule.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RuleStatusConverter implements AttributeConverter<RuleStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(RuleStatus attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public RuleStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : RuleStatus.fromCode(dbData);
    }
}
