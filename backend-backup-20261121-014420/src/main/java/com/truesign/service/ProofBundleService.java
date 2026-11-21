package com.truesign.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.truesign.dto.response.ProofBundleResponse;
import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import com.truesign.entity.ProofBundle;
import com.truesign.repository.ProofBundleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ProofBundleService {

    private final ProofBundleRepository repository;
    private final Gson gson;

    public ProofBundleService(ProofBundleRepository repository) {
        this.repository = repository;
        this.gson = new GsonBuilder().create();
    }

    @Transactional
    public ProofBundleResponse createProofBundle(
            PaymentPassport passport,
            List<VerifierVerdictDto> verdicts,
            String overallVerdict
    ) {
        if (passport == null || verdicts == null ||
                overallVerdict == null || overallVerdict.isBlank()) {
            throw new IllegalArgumentException(
                    "Passport, verifier results and verdict are required."
            );
        }

        Instant now = Instant.now();

        JsonObject proof = new JsonObject();
        proof.addProperty("proofVersion", "2.0");
        proof.addProperty("passportId", passport.getId());
        proof.addProperty("passportHash", passport.getPassportHash());
        proof.addProperty("intentHash", passport.getIntentHash());
        proof.addProperty("applicationTransactionHash",
                passport.getTransactionHash());
        proof.addProperty("account", passport.getAccount());
        proof.addProperty("chainId", passport.getChainId());
        proof.addProperty("overallVerdict", overallVerdict);
        proof.add("verifierResults", gson.toJsonTree(verdicts));
        proof.addProperty("createdAt", now.toString());

        ProofBundle bundle = new ProofBundle();
        bundle.setId(UUID.randomUUID().toString());
        bundle.setPassportId(passport.getId());
        bundle.setPassportHash(passport.getPassportHash());
        bundle.setOverallVerdict(overallVerdict);
        bundle.setProofPayload(gson.toJson(proof));
        bundle.setCreatedAt(now);

        return toResponse(repository.save(bundle));
    }

    @Transactional
    public ProofBundleResponse attachAttestation(
            String passportId,
            String safeTxHash,
            String digest,
            long expiry,
            List<String> signers,
            List<String> signatures,
            String attestationTransactionHash
    ) {
        ProofBundle bundle = latestEntity(passportId);

        JsonObject proof = parse(bundle);

        JsonObject authorization = new JsonObject();
        authorization.addProperty("safeTransactionHash", safeTxHash);
        authorization.addProperty("eip712Digest", digest);
        authorization.addProperty("expiry", expiry);
        authorization.addProperty("attestationTransactionHash",
                attestationTransactionHash);
        authorization.add("signers", gson.toJsonTree(signers));
        authorization.add("signatures", gson.toJsonTree(signatures));
        authorization.addProperty("status", "CONFIRMED_ON_CHAIN");
        authorization.addProperty("recordedAt", Instant.now().toString());

        proof.add("safeAuthorization", authorization);

        bundle.setProofPayload(gson.toJson(proof));

        return toResponse(repository.save(bundle));
    }

    @Transactional
    public ProofBundleResponse attachExecutionReceipt(
            String passportId,
            ExecutionReceiptService.ExecutionReceipt receipt
    ) {
        if (receipt == null) {
            throw new IllegalArgumentException("Execution receipt is required.");
        }

        ProofBundle bundle = latestEntity(passportId);
        JsonObject proof = parse(bundle);

        JsonObject execution = new JsonObject();
        execution.addProperty("transactionHash", receipt.transactionHash());
        execution.addProperty(
                "blockNumber",
                receipt.blockNumber() == null
                        ? null
                        : receipt.blockNumber().toString()
        );
        execution.addProperty("successful", receipt.successful());
        execution.addProperty("receiptStatus", receipt.status());
        execution.addProperty(
                "gasUsed",
                receipt.gasUsed() == null
                        ? null
                        : receipt.gasUsed().toString()
        );
        execution.addProperty(
                "executedAt",
                receipt.executedAt() == null
                        ? null
                        : receipt.executedAt().toString()
        );
        execution.addProperty(
                "outcome",
                receipt.successful() ? "EXECUTED_SUCCESSFULLY" : "EXECUTION_FAILED"
        );
        execution.addProperty("recordedAt", Instant.now().toString());

        proof.add("executionReceipt", execution);

        bundle.setProofPayload(gson.toJson(proof));

        return toResponse(repository.save(bundle));
    }

    @Transactional(readOnly = true)
    public ProofBundleResponse getLatestProofBundle(String passportId) {
        return toResponse(latestEntity(passportId));
    }

    private ProofBundle latestEntity(String passportId) {
        if (passportId == null || passportId.isBlank()) {
            throw new IllegalArgumentException("Passport ID is required.");
        }

        return repository
                .findFirstByPassportIdOrderByCreatedAtDesc(passportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Proof bundle not found for passport: " + passportId
                ));
    }

    private JsonObject parse(ProofBundle bundle) {
        try {
            return JsonParser.parseString(bundle.getProofPayload())
                    .getAsJsonObject();
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Stored proof payload is invalid JSON.", exception
            );
        }
    }

    private ProofBundleResponse toResponse(ProofBundle bundle) {
        return new ProofBundleResponse(
                bundle.getId(),
                bundle.getPassportId(),
                bundle.getPassportHash(),
                bundle.getOverallVerdict(),
                bundle.getProofPayload(),
                bundle.getCreatedAt()
        );
    }
}