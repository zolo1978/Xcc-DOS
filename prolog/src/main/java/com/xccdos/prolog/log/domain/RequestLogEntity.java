package com.xccdos.prolog.log.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "request_log")
public class RequestLogEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(name = "session_id")
    private String sessionId;

    @Column(name = "request_uuid", nullable = false)
    private String requestUuid;

    @Column(name = "request_type", nullable = false)
    private String requestType;

    @Column(name = "request_content")
    private String requestContent;

    @Column(name = "response_content")
    private String responseContent;

    @Column(name = "rule_id")
    private Long ruleId;

    @Column(name = "request_status", nullable = false)
    private RequestStatus requestStatus;

    @Column(name = "cost_time")
    private Long costTime;

    @Column(name = "request_ip")
    private String requestIp;

    @Column(name = "is_sample", nullable = false)
    private short isSample;

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

    public String getRequestUuid() {
        return requestUuid;
    }

    public void setRequestUuid(String requestUuid) {
        this.requestUuid = requestUuid;
    }

    public String getRequestType() {
        return requestType;
    }

    public void setRequestType(String requestType) {
        this.requestType = requestType;
    }

    public String getRequestContent() {
        return requestContent;
    }

    public void setRequestContent(String requestContent) {
        this.requestContent = requestContent;
    }

    public String getResponseContent() {
        return responseContent;
    }

    public void setResponseContent(String responseContent) {
        this.responseContent = responseContent;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public void setRuleId(Long ruleId) {
        this.ruleId = ruleId;
    }

    public RequestStatus getRequestStatus() {
        return requestStatus;
    }

    public void setRequestStatus(RequestStatus requestStatus) {
        this.requestStatus = requestStatus;
    }

    public Long getCostTime() {
        return costTime;
    }

    public void setCostTime(Long costTime) {
        this.costTime = costTime;
    }

    public String getRequestIp() {
        return requestIp;
    }

    public void setRequestIp(String requestIp) {
        this.requestIp = requestIp;
    }

    public short getIsSample() {
        return isSample;
    }

    public void setIsSample(short isSample) {
        this.isSample = isSample;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }
}
