package com.xccdos.prolog.common.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.OffsetDateTime;

@MappedSuperclass
public abstract class AuditableEntity {

    @Column(name = "create_time", nullable = false)
    private OffsetDateTime createTime;

    @Column(name = "update_time", nullable = false)
    private OffsetDateTime updateTime;

    @Column(name = "delete_flag", nullable = false)
    private short deleteFlag = 0;

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createTime = now;
        this.updateTime = now;
        if (deleteFlag != 1) {
            this.deleteFlag = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updateTime = OffsetDateTime.now();
    }

    public OffsetDateTime getCreateTime() {
        return createTime;
    }

    public OffsetDateTime getUpdateTime() {
        return updateTime;
    }

    public short getDeleteFlag() {
        return deleteFlag;
    }

    public void setDeleteFlag(short deleteFlag) {
        this.deleteFlag = deleteFlag;
    }
}
