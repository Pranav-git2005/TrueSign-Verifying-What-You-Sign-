package com.truesign.controller;

import com.truesign.dto.request.SimulationRequest;
import com.truesign.dto.response.SimulationRunResponse;
import com.truesign.service.AttackSimulationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/simulation")
public class AttackSimulationController {
    private final AttackSimulationService simulationService;
    public AttackSimulationController(AttackSimulationService simulationService) { this.simulationService = simulationService; }

    @PostMapping("/{passportId}/run")
    public SimulationRunResponse run(@PathVariable String passportId, @RequestBody(required = false) SimulationRequest request) {
        try {
            return simulationService.run(passportId, request);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex);
        }
    }
}
