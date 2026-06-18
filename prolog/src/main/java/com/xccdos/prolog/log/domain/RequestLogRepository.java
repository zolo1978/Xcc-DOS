package com.xccdos.prolog.log.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequestLogRepository extends JpaRepository<RequestLogEntity, Long> {

    List<RequestLogEntity> findTop100ByIsSampleAndDeleteFlagOrderByCreateTimeDesc(short isSample, short deleteFlag);
}
