
package com.truesign.controller;

import com.truesign.dto.request.CreatePassportRequest;
import com.truesign.dto.response.PassportResponse;
import com.truesign.service.PassportService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/passports")
public class PassportController {

    private final PassportService passportService;

    public PassportController(PassportService passportService) {
        this.passportService = passportService;
    }

    @PostMapping
    public ResponseEntity<PassportResponse> createPassport(
            @Valid @RequestBody CreatePassportRequest request) {

        PassportResponse response =
                passportService.createPassport(request);

        return ResponseEntity
                .created(URI.create("/api/passports/" + response.passportId()))
                .body(response);
    }

    @GetMapping("/{passportId}")
    public ResponseEntity<PassportResponse> getPassport(
            @PathVariable String passportId) {

        return ResponseEntity.ok(
                passportService.getPassport(passportId)
        );
    }
}
