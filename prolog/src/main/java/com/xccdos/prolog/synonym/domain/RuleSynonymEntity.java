package com.xccdos.prolog.synonym.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "rule_synonym")
public class RuleSynonymEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "origin_word", nullable = false)
    private String originWord;

    @Column(name = "synonym_word", nullable = false)
    private String synonymWord;

    @Column(name = "priority", nullable = false)
    private Integer priority;

    @Column(name = "status", nullable = false)
    private SynonymStatus status;

    @Column(name = "tenant_id")
    private Long tenantId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOriginWord() {
        return originWord;
    }

    public void setOriginWord(String originWord) {
        this.originWord = originWord;
    }

    public String getSynonymWord() {
        return synonymWord;
    }

    public void setSynonymWord(String synonymWord) {
        this.synonymWord = synonymWord;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public SynonymStatus getStatus() {
        return status;
    }

    public void setStatus(SynonymStatus status) {
        this.status = status;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
