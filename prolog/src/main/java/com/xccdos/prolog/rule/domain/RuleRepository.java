package com.xccdos.prolog.rule.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RuleRepository extends JpaRepository<RulePrologEntity, Long>, JpaSpecificationExecutor<RulePrologEntity> {

    boolean existsByRuleCode(String ruleCode);
}
