package com.xccdos.prolog.evolution.application;

import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import com.xccdos.prolog.tenant.domain.TenantRuntimeStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class EvolutionClusteringScheduler {

    private static final Logger LOGGER = LoggerFactory.getLogger(EvolutionClusteringScheduler.class);

    private final TenantRepository tenantRepository;
    private final ClusteringService clusteringService;

    public EvolutionClusteringScheduler(TenantRepository tenantRepository, ClusteringService clusteringService) {
        this.tenantRepository = tenantRepository;
        this.clusteringService = clusteringService;
    }

    public void runScheduledClustering() {
        for (TenantEntity tenant : tenantRepository.findAll()) {
            if (TenantRuntimeStatus.fromEntity(tenant) != TenantRuntimeStatus.ACTIVE) {
                continue;
            }
            try {
                clusteringService.clusterTenant(tenant.getTenantCode(), EvolutionClusterTriggerType.SCHEDULED);
            } catch (RuntimeException exception) {
                LOGGER.warn("Failed to cluster tenant {}", tenant.getTenantCode(), exception);
            }
        }
    }
}
