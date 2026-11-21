package com.truesign.controller;

import com.truesign.dto.response.ExecutionAttachResponse;
import com.truesign.dto.response.ProofBundleResponse;
import com.truesign.service.ExecutionReceiptService;
import com.truesign.service.ProofBundleService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.web3j.protocol.Web3j;

@RestController
@RequestMapping("/api/proofs")
public class ProofController {
    private final ProofBundleService proofBundleService;
    private final ExecutionReceiptService receiptService;
    private final Web3j web3j;

    public ProofController(ProofBundleService proofBundleService, ExecutionReceiptService receiptService, Web3j web3j) {
        this.proofBundleService = proofBundleService;
        this.receiptService = receiptService;
        this.web3j = web3j;
    }

    public record ExecutionReceiptRequest(String transactionHash) {}

    @GetMapping("/{passportId}")
    public ProofBundleResponse getProof(@PathVariable String passportId) {
        return proofBundleService.getLatestProofBundle(passportId);
    }

    @PostMapping("/{passportId}/execution")
    public ResponseEntity<ExecutionAttachResponse> attachExecution(
            @PathVariable String passportId,
            @RequestBody(required = false) ExecutionReceiptRequest request) {
        String hash = request == null ? null : request.transactionHash();
        if (hash == null || !hash.matches("0x[0-9a-fA-F]{64}")) {
            return ResponseEntity.badRequest().body(new ExecutionAttachResponse(
                    "INVALID_HASH", "A valid 32-byte Ethereum transaction hash is required.", hash, null, null));
        }

        try {
            var txResponse = web3j.ethGetTransactionByHash(hash).send();
            if (txResponse.getTransaction().isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ExecutionAttachResponse(
                        "UNKNOWN_TRANSACTION", "The transaction hash is not known to the configured RPC node.", hash, null, null));
            }

            var receipt = receiptService.getExecutionReceipt(hash);
            if (receipt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ExecutionAttachResponse(
                        "PENDING", "Transaction is known but has not been mined. Retry after confirmation.", hash, null, null));
            }

            var saved = proofBundleService.attachExecutionReceipt(passportId, receipt.get());
            boolean successful = receipt.get().successful();
            return ResponseEntity.ok(new ExecutionAttachResponse(
                    successful ? "MINED_SUCCESS" : "MINED_FAILED",
                    successful ? "Mined transaction receipt attached to the proof bundle." :
                            "Transaction was mined but its EVM execution failed. Receipt attached to the proof bundle.",
                    hash, successful, saved));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new ExecutionAttachResponse(
                    "INVALID_REQUEST", ex.getMessage(), hash, null, null));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new ExecutionAttachResponse(
                    "RPC_UNAVAILABLE", "Could not retrieve transaction status from the configured blockchain RPC: " +
                    (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), hash, null, null));
        }
    }
}
