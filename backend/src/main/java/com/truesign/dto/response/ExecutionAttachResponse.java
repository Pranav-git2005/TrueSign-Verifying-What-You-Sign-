package com.truesign.dto.response;

public record ExecutionAttachResponse(
        String state,
        String message,
        String transactionHash,
        Boolean successful,
        ProofBundleResponse proofBundle
) {}
