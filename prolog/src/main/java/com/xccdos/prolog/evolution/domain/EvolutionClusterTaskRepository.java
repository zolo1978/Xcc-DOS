package com.xccdos.prolog.evolution.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvolutionClusterTaskRepository extends JpaRepository<EvolutionClusterTaskEntity, Long> {

    List<EvolutionClusterTaskEntity> findAllByOrderByCreateTimeDesc();
}
