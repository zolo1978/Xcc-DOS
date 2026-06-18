package com.xccdos.prolog.evolution.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GeneratedRuleRepository extends JpaRepository<GeneratedRuleEntity, Long> {

    List<GeneratedRuleEntity> findAllByOrderByCreateTimeDesc();

    List<GeneratedRuleEntity> findAllByReviewStatusOrderByCreateTimeDesc(GeneratedRuleReviewStatus reviewStatus);
}
