package com.xccdos.prolog.rule.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "rule_prolog")
public class RulePrologEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "rule_name", nullable = false)
    private String ruleName;

    @Column(name = "rule_code", nullable = false)
    private String ruleCode;

    @Column(name = "rule_content", nullable = false)
    private String ruleContent;

    @Column(name = "rule_type", nullable = false)
    private RuleType ruleType;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "status", nullable = false)
    private RuleStatus status;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "gray_rate", nullable = false)
    private Integer grayRate;

    @Column(name = "is_auto_gen", nullable = false)
    private short isAutoGen;

    @Column(name = "tenant_id")
    private Long tenantId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRuleName() {
        return ruleName;
    }

    public void setRuleName(String ruleName) {
        this.ruleName = ruleName;
    }

    public String getRuleCode() {
        return ruleCode;
    }

    public void setRuleCode(String ruleCode) {
        this.ruleCode = ruleCode;
    }

    public String getRuleContent() {
        return ruleContent;
    }

    public void setRuleContent(String ruleContent) {
        this.ruleContent = ruleContent;
    }

    public RuleType getRuleType() {
        return ruleType;
    }

    public void setRuleType(RuleType ruleType) {
        this.ruleType = ruleType;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public RuleStatus getStatus() {
        return status;
    }

    public void setStatus(RuleStatus status) {
        this.status = status;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Integer getGrayRate() {
        return grayRate;
    }

    public void setGrayRate(Integer grayRate) {
        this.grayRate = grayRate;
    }

    public short getIsAutoGen() {
        return isAutoGen;
    }

    public void setIsAutoGen(short isAutoGen) {
        this.isAutoGen = isAutoGen;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
