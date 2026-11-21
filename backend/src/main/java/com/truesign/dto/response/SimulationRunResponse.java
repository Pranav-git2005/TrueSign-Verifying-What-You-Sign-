package com.truesign.dto.response;

import java.time.Instant;
import java.util.List;

public record SimulationRunResponse(
        String passportId,
        Instant executedAt,
        String executionMode,
        int blockedCount,
        int passedCount,
        int vulnerableCount,
        int inconclusiveCount,
        List<SimulationScenarioResult> results,
        String disclaimer
) {}
