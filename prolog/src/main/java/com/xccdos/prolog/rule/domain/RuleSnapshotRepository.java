package com.xccdos.prolog.rule.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RuleSnapshotRepository extends JpaRepository<RuleSnapshotEntity, Long> {

    Optional<RuleSnapshotEntity> findByRuleIdAndVersion(Long ruleId, Integer version);
}
