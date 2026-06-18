package com.xccdos.prolog.security;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import com.xccdos.prolog.tenant.domain.TenantRuntimeStatus;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final TenantRepository tenantRepository;

    public JwtAuthenticationFilter(JwtService jwtService, TenantRepository tenantRepository) {
        this.jwtService = jwtService;
        this.tenantRepository = tenantRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                filterChain.doFilter(request, response);
                return;
            }

            Claims claims = jwtService.parse(authorization.substring(7));
            String tenantCode = claims.get("tenant", String.class);
            if (tenantCode == null || tenantCode.isBlank()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID", "Missing tenant claim");
            }
            String headerTenant = request.getHeader("X-Tenant-Id");
            if (headerTenant != null && !headerTenant.equals(tenantCode)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_HEADER_MISMATCH", "X-Tenant-Id does not match token tenant");
            }

            String schema = TenantContext.PUBLIC_SCHEMA;
            if (!TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
                Optional<TenantEntity> tenantOptional = tenantRepository.findByTenantCode(tenantCode);
                TenantEntity tenant = tenantOptional.orElseThrow(() ->
                        new ApiException(HttpStatus.FORBIDDEN, "TENANT_NOT_FOUND", "Tenant does not exist"));
                TenantRuntimeStatus runtimeStatus = TenantRuntimeStatus.fromEntity(tenant);
                if (runtimeStatus != TenantRuntimeStatus.ACTIVE) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "TENANT_INACTIVE", "Tenant is not active");
                }
                schema = TenantSchemaNames.forTenantCode(tenantCode);
            }

            TenantContext.setCurrentTenant(tenantCode, schema);
            List<? extends GrantedAuthority> authorities = Collections.emptyList();
            Number roleLevel = claims.get("role_level", Number.class);
            if (roleLevel != null) {
                authorities = RoleLevelAuthority.authoritiesFor(roleLevel.shortValue());
            }
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    claims.getSubject(), null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (ApiException exception) {
            response.setStatus(exception.getStatus().value());
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"" + exception.getCode() + "\",\"message\":\"" + exception.getMessage() + "\"}");
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }
}
