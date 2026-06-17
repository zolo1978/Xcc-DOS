package com.xccdos.prolog.tenant.web;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;

public record CreateTenantRequest(
        @NotBlank(message = "name is required") String name,
        @NotBlank(message = "code is required") String code,
        @NotBlank(message = "isolateType is required") String isolateType,
        OffsetDateTime expireTime,
        String contactPerson,
        String contactPhone
) {
}
