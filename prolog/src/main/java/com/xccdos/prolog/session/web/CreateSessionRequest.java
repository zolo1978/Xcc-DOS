package com.xccdos.prolog.session.web;

public record CreateSessionRequest(
        String userIp,
        String currentState,
        String contextData
) {
}
