package com.xccdos.prolog.security;

import com.xccdos.prolog.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    private final JwtProperties jwtProperties;
    private final SecretKey secretKey;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        this.secretKey = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public Claims parse(String token) {
        Jws<Claims> jws = Jwts.parser()
                .requireIssuer(jwtProperties.getIssuer())
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token);
        return jws.getPayload();
    }
}
