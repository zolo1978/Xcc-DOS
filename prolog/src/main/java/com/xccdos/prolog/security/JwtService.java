package com.xccdos.prolog.security;

import com.xccdos.prolog.config.JwtProperties;
import com.xccdos.prolog.common.api.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    private static final Duration ACCESS_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration REFRESH_TOKEN_TTL = Duration.ofDays(7);

    private final JwtProperties jwtProperties;
    private final SecretKey secretKey;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        this.secretKey = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public Claims parse(String token) {
        try {
            Jws<Claims> jws = Jwts.parser()
                    .requireIssuer(jwtProperties.getIssuer())
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return jws.getPayload();
        } catch (ExpiredJwtException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_TOKEN_EXPIRED", "Token expired");
        } catch (JwtException | IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID", "Missing or invalid bearer token");
        }
    }

    public String issueAccessToken(String username, String tenantCode, short roleLevel) {
        return issueToken(username, tenantCode, roleLevel, "access", ACCESS_TOKEN_TTL);
    }

    public String issueRefreshToken(String username, String tenantCode, short roleLevel) {
        return issueToken(username, tenantCode, roleLevel, "refresh", REFRESH_TOKEN_TTL);
    }

    private String issueToken(String username, String tenantCode, short roleLevel, String tokenType, Duration ttl) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(jwtProperties.getIssuer())
                .subject(username)
                .claim("tenant", tenantCode)
                .claim("role_level", Short.toUnsignedInt(roleLevel))
                .claim("token_type", tokenType)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(secretKey)
                .compact();
    }
}
