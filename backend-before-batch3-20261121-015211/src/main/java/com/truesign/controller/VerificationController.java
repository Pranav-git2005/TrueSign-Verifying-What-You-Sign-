
package com.truesign.controller;

import com.truesign.dto.request.VerifyTransactionRequest;
import com.truesign.dto.response.VerificationResponse;
import com.truesign.service.VerificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/verify")
public class VerificationController {

    private final VerificationService verificationService;

    public VerificationController(
            VerificationService verificationService) {
        this.verificationService = verificationService;
    }

    // POST /api/verify
    @PostMapping
    public ResponseEntity<VerificationResponse> verify(
            @Valid @RequestBody VerifyTransactionRequest request) {

        VerificationResponse response =
                verificationService.verifyPassport(request.passportId());

        return ResponseEntity.ok(response);
    }

    // POST /api/verify/{passportId}
    @PostMapping("/{passportId}")
    public ResponseEntity<VerificationResponse> verifyByPassportId(
            @PathVariable String passportId) {

        VerificationResponse response =
                verificationService.verifyPassport(passportId);

        return ResponseEntity.ok(response);
    }
}
