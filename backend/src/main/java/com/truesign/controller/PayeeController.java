package com.truesign.controller;

import com.truesign.blockchain.PayeeRegistryService;
import com.truesign.dto.request.RegisterPayeeRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payees")
public class PayeeController {

    private final PayeeRegistryService payeeRegistryService;

    public PayeeController(PayeeRegistryService payeeRegistryService) {
        this.payeeRegistryService = payeeRegistryService;
    }

    @PostMapping("/confirm-registration")
    public ResponseEntity<Map<String, Object>> confirmRegistration(
            @Valid @RequestBody RegisterPayeeRequest request
    ) throws Exception {
        return ResponseEntity.ok(
                payeeRegistryService.confirmRegistration(request)
        );
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @RequestParam String account,
            @RequestParam String payee
    ) throws Exception {
        return ResponseEntity.ok(
                payeeRegistryService.getPayeeStatus(account, payee)
        );
    }
}