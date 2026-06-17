package com.xccdos.prolog.session.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "user_session")
public class UserSessionEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true)
    private String sessionId;

    @Column(name = "user_ip")
    private String userIp;

    @Column(name = "current_state")
    private String currentState;

    @Column(name = "context_data")
    private String contextData;

    @Column(name = "last_active_time", nullable = false)
    private OffsetDateTime lastActiveTime;

    @Column(name = "expire_time", nullable = false)
    private OffsetDateTime expireTime;

    @Column(name = "session_status", nullable = false)
    private SessionStatus sessionStatus;

    @Column(name = "tenant_id")
    private Long tenantId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getUserIp() {
        return userIp;
    }

    public void setUserIp(String userIp) {
        this.userIp = userIp;
    }

    public String getCurrentState() {
        return currentState;
    }

    public void setCurrentState(String currentState) {
        this.currentState = currentState;
    }

    public String getContextData() {
        return contextData;
    }

    public void setContextData(String contextData) {
        this.contextData = contextData;
    }

    public OffsetDateTime getLastActiveTime() {
        return lastActiveTime;
    }

    public void setLastActiveTime(OffsetDateTime lastActiveTime) {
        this.lastActiveTime = lastActiveTime;
    }

    public OffsetDateTime getExpireTime() {
        return expireTime;
    }

    public void setExpireTime(OffsetDateTime expireTime) {
        this.expireTime = expireTime;
    }

    public SessionStatus getSessionStatus() {
        return sessionStatus;
    }

    public void setSessionStatus(SessionStatus sessionStatus) {
        this.sessionStatus = sessionStatus;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
