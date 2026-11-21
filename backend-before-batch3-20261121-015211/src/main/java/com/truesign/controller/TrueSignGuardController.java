package com.truesign.controller;

import com.truesign.blockchain.TrueSignGuardService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guard/attestations")
public class TrueSignGuardController {

    private final TrueSignGuardService guardService;

    public TrueSignGuardController(TrueSignGuardService guardService) {
        this.guardService = guardService;
    }

    @PostMapping("/{passportId}")
    @ResponseStatus(HttpStatus.CREATED)
    public TrueSignGuardService.GuardAttestationResult authorize(
            @PathVariable String passportId
    ) throws Exception {
        return guardService.authorizePassport(passportId);
    }
}