package com.xccdos.prolog.tenant.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<TenantEntity, Long> {

    boolean existsByTenantCode(String tenantCode);

    Optional<TenantEntity> findByTenantCode(String tenantCode);
}
