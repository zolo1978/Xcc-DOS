package com.xccdos.prolog.auth.application;

import com.xccdos.prolog.auth.web.AuthTokenResponse;
import com.xccdos.prolog.auth.web.LoginRequest;
import com.xccdos.prolog.auth.web.RefreshTokenRequest;
import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import com.xccdos.prolog.security.JwtService;
import com.xccdos.prolog.security.PasswordHasher;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import com.xccdos.prolog.tenant.domain.TenantRuntimeStatus;
import com.xccdos.prolog.user.domain.UserEntity;
import com.xccdos.prolog.user.domain.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordHasher passwordHasher;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            PasswordHasher passwordHasher,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.passwordHasher = passwordHasher;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public AuthTokenResponse login(LoginRequest request) {
        UserEntity user = loadActiveUser(request.tenantCode(), request.username());
        if (!passwordHasher.verify(user.getPassword(), request.password())) {
            throw new BadCredentialsException("用户名或密码错误");
        }
        return tokenPair(user.getUsername(), normalizedTenantCode(request.tenantCode()), user.getRoleLevel());
    }

    @Transactional(readOnly = true)
    public AuthTokenResponse refresh(RefreshTokenRequest request) {
        Claims claims = jwtService.parse(request.refreshToken());
        if (!"refresh".equals(claims.get("token_type", String.class))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID", "Invalid refresh token");
        }
        String tenantCode = claims.get("tenant", String.class);
        UserEntity user = loadActiveUser(tenantCode, claims.getSubject());
        return tokenPair(user.getUsername(), tenantCode, user.getRoleLevel());
    }

    private UserEntity loadActiveUser(String tenantCode, String username) {
        setTenantContext(tenantCode);
        try {
            UserEntity user = userRepository.findByUsernameAndDeleteFlag(username, (short) 0)
                    .orElseThrow(() -> new BadCredentialsException("用户名或密码错误"));
            if (user.getStatus() != 1) {
                throw new ApiException(HttpStatus.FORBIDDEN, "AUTH_INACTIVE", "账号已禁用，请联系管理员");
            }
            return user;
        } finally {
            TenantContext.clear();
        }
    }

    private AuthTokenResponse tokenPair(String username, String tenantCode, short roleLevel) {
        return new AuthTokenResponse(
                jwtService.issueAccessToken(username, tenantCode, roleLevel),
                jwtService.issueRefreshToken(username, tenantCode, roleLevel)
        );
    }

    private void setTenantContext(String tenantCode) {
        String normalizedTenantCode = normalizedTenantCode(tenantCode);
        if (TenantContext.PUBLIC_SCHEMA.equals(normalizedTenantCode)) {
            TenantContext.setCurrentTenant(normalizedTenantCode, TenantContext.PUBLIC_SCHEMA);
            return;
        }
        TenantEntity tenant = tenantRepository.findByTenantCode(normalizedTenantCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant does not exist"));
        if (TenantRuntimeStatus.fromEntity(tenant) != TenantRuntimeStatus.ACTIVE) {
            throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_INACTIVE", "Tenant is not active");
        }
        TenantContext.setCurrentTenant(normalizedTenantCode, TenantSchemaNames.forTenantCode(normalizedTenantCode));
    }

    private String normalizedTenantCode(String tenantCode) {
        return tenantCode == null ? null : tenantCode.trim().toLowerCase();
    }
}
