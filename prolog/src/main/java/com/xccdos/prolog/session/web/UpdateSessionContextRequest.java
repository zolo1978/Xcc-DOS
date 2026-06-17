package com.xccdos.prolog.session.web;

public record UpdateSessionContextRequest(
        String currentState,
        String contextData
) {
}
