package com.xccdos.prolog.tenant.web;

import jakarta.validation.constraints.NotBlank;

public record UpdateTenantStatusRequest(
        @NotBlank(message = "status is required") String status
) {
}
