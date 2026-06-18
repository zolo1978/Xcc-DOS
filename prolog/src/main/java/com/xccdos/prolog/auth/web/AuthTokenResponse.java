package com.xccdos.prolog.auth.web;

public record AuthTokenResponse(
        String accessToken,
        String refreshToken
) {
}
