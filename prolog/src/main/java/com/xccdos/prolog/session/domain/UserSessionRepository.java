package com.xccdos.prolog.session.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSessionEntity, Long> {

    Optional<UserSessionEntity> findBySessionIdAndDeleteFlag(String sessionId, short deleteFlag);
}
