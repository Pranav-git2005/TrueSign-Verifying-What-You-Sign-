package com.truesign.dto.request;

import java.util.List;

public record SimulationRequest(List<String> scenarios) {
    public SimulationRequest {
        scenarios = scenarios == null || scenarios.isEmpty()
                ? List.of("AMOUNT_MANIPULATION", "UNAUTHORIZED_TARGET", "SELECTOR_MANIPULATION", "NONCE_REPLAY", "RECIPIENT_MANIPULATION", "UNAUTHORIZED_EXECUTION", "GUARD_BYPASS")
                : List.copyOf(scenarios);
    }
}
