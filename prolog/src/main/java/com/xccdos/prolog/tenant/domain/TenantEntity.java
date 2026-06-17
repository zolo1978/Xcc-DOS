package com.xccdos.prolog.tenant.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "sys_tenant", schema = "public")
public class TenantEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "tenant_name", nullable = false)
    private String tenantName;

    @Column(name = "tenant_code", nullable = false)
    private String tenantCode;

    @Column(name = "isolate_type", nullable = false)
    private TenantIsolationType isolateType;

    @Column(name = "status", nullable = false)
    private TenantDbStatus status;

    @Column(name = "expire_time")
    private OffsetDateTime expireTime;

    @Column(name = "contact_person")
    private String contactPerson;

    @Column(name = "contact_phone")
    private String contactPhone;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTenantName() {
        return tenantName;
    }

    public void setTenantName(String tenantName) {
        this.tenantName = tenantName;
    }

    public String getTenantCode() {
        return tenantCode;
    }

    public void setTenantCode(String tenantCode) {
        this.tenantCode = tenantCode;
    }

    public TenantIsolationType getIsolateType() {
        return isolateType;
    }

    public void setIsolateType(TenantIsolationType isolateType) {
        this.isolateType = isolateType;
    }

    public TenantDbStatus getStatus() {
        return status;
    }

    public void setStatus(TenantDbStatus status) {
        this.status = status;
    }

    public OffsetDateTime getExpireTime() {
        return expireTime;
    }

    public void setExpireTime(OffsetDateTime expireTime) {
        this.expireTime = expireTime;
    }

    public String getContactPerson() {
        return contactPerson;
    }

    public void setContactPerson(String contactPerson) {
        this.contactPerson = contactPerson;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }
}
