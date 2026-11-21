package com.truesign.controller;

import com.truesign.dto.response.ProofBundleResponse;
import com.truesign.service.ExecutionReceiptService;
import com.truesign.service.ProofBundleService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/proofs")
public class ProofController {

    private final ProofBundleService proofBundleService;
    private final ExecutionReceiptService receiptService;

    public ProofController(
            ProofBundleService proofBundleService,
            ExecutionReceiptService receiptService
    ) {
        this.proofBundleService = proofBundleService;
        this.receiptService = receiptService;
    }

    public record ExecutionReceiptRequest(String transactionHash) {}

    @GetMapping("/{passportId}")
    public ProofBundleResponse getProof(
            @PathVariable String passportId
    ) {
        return proofBundleService.getLatestProofBundle(passportId);
    }

    @PostMapping("/{passportId}/execution")
    public ProofBundleResponse attachExecution(
            @PathVariable String passportId,
            @RequestBody ExecutionReceiptRequest request
    ) {
        if (request == null || request.transactionHash() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Transaction hash is required."
            );
        }

        var receipt = receiptService.getExecutionReceipt(
                request.transactionHash()
        );

        if (receipt.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.ACCEPTED,
                    "Transaction is not mined yet. Retry after confirmation."
            );
        }

        return proofBundleService.attachExecutionReceipt(
                passportId,
                receipt.get()
        );
    }
}