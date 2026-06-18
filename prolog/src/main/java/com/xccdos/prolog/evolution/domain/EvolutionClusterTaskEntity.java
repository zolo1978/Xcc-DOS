package com.xccdos.prolog.evolution.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "evolution_cluster_task")
public class EvolutionClusterTaskEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "status", nullable = false)
    private EvolutionClusterTaskStatus status;

    @Column(name = "sample_count", nullable = false)
    private Integer sampleCount;

    @Column(name = "cluster_result", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String clusterResult;

    @Column(name = "trigger_type", nullable = false)
    private EvolutionClusterTriggerType triggerType;

    @Column(name = "tenant_id")
    private Long tenantId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public EvolutionClusterTaskStatus getStatus() {
        return status;
    }

    public void setStatus(EvolutionClusterTaskStatus status) {
        this.status = status;
    }

    public Integer getSampleCount() {
        return sampleCount;
    }

    public void setSampleCount(Integer sampleCount) {
        this.sampleCount = sampleCount;
    }

    public String getClusterResult() {
        return clusterResult;
    }

    public void setClusterResult(String clusterResult) {
        this.clusterResult = clusterResult;
    }

    public EvolutionClusterTriggerType getTriggerType() {
        return triggerType;
    }

    public void setTriggerType(EvolutionClusterTriggerType triggerType) {
        this.triggerType = triggerType;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
