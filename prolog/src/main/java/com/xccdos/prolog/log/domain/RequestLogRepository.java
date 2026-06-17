package com.xccdos.prolog.log.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RequestLogRepository extends JpaRepository<RequestLogEntity, Long> {
}
