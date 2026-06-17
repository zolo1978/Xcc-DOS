package com.xccdos.prolog.user.domain;

import com.xccdos.prolog.common.jpa.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sys_user")
public class UserEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "role_level", nullable = false)
    private short roleLevel;

    @Column(nullable = false)
    private short status;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
}
