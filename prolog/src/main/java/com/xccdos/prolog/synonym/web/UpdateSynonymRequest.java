package com.xccdos.prolog.synonym.web;

import jakarta.validation.constraints.NotBlank;

public record UpdateSynonymRequest(
        @NotBlank(message = "originWord is required") String originWord,
        @NotBlank(message = "synonymWord is required") String synonymWord,
        Integer priority,
        String status
) {
}
