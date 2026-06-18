package com.xccdos.prolog.evolution.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "generated_rule")
public class GeneratedRuleEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "source_cluster_id", nullable = false)
    private Long sourceClusterId;

    @Column(name = "rule_content", nullable = false)
    private String ruleContent;

    @Column(name = "confidence")
    private String confidence;

    @Column(name = "review_status", nullable = false)
    private GeneratedRuleReviewStatus reviewStatus;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "review_comment")
    private String reviewComment;

    @Column(name = "langflow_run_id")
    private String langflowRunId;

    @Column(name = "tenant_id")
    private Long tenantId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSourceClusterId() {
        return sourceClusterId;
    }

    public void setSourceClusterId(Long sourceClusterId) {
        this.sourceClusterId = sourceClusterId;
    }

    public String getRuleContent() {
        return ruleContent;
    }

    public void setRuleContent(String ruleContent) {
        this.ruleContent = ruleContent;
    }

    public String getConfidence() {
        return confidence;
    }

    public void setConfidence(String confidence) {
        this.confidence = confidence;
    }

    public GeneratedRuleReviewStatus getReviewStatus() {
        return reviewStatus;
    }

    public void setReviewStatus(GeneratedRuleReviewStatus reviewStatus) {
        this.reviewStatus = reviewStatus;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public String getReviewComment() {
        return reviewComment;
    }

    public void setReviewComment(String reviewComment) {
        this.reviewComment = reviewComment;
    }

    public String getLangflowRunId() {
        return langflowRunId;
    }

    public void setLangflowRunId(String langflowRunId) {
        this.langflowRunId = langflowRunId;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
