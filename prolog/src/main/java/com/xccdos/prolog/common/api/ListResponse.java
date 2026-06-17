package com.xccdos.prolog.common.api;

import java.util.List;

public record ListResponse<T>(List<T> items) {
}
