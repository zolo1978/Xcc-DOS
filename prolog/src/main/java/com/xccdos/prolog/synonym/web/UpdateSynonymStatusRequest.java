package com.xccdos.prolog.synonym.web;

import jakarta.validation.constraints.NotBlank;

public record UpdateSynonymStatusRequest(
        @NotBlank(message = "status is required") String status
) {
}
