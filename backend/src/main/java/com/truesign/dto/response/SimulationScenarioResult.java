package com.truesign.dto.response;

public record SimulationScenarioResult(
        String scenario,
        String status,
        String title,
        String summary,
        String expected,
        String actual
) {}
