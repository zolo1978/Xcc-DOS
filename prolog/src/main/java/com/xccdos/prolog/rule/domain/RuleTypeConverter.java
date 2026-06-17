package com.xccdos.prolog.rule.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RuleTypeConverter implements AttributeConverter<RuleType, Short> {

    @Override
    public Short convertToDatabaseColumn(RuleType attribute) {
        return attribute == null ? null : attribute.getCode();
    }

    @Override
    public RuleType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : RuleType.fromCode(dbData);
    }
}
