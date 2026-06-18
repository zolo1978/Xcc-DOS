package com.xccdos.prolog.auth.web;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "username is required") String username,
        @NotBlank(message = "password is required") String password,
        @JsonProperty("tenant_code")
        @JsonAlias("tenantCode")
        @NotBlank(message = "tenantCode is required") String tenantCode
) {
}
