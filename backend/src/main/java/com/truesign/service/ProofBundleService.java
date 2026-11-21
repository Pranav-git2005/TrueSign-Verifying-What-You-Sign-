
package com.truesign.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

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
    private final ObjectMapper objectMapper;

    public ProofBundleService(
            ProofBundleRepository repository,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
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

        ObjectNode proof = objectMapper.createObjectNode();

        proof.put("proofVersion", "2.0");
        proof.put("passportId", passport.getId());
        proof.put("passportHash", passport.getPassportHash());
        proof.put("intentHash", passport.getIntentHash());

        proof.put(
                "applicationTransactionHash",
                passport.getTransactionHash()
        );

        proof.put("account", passport.getAccount());
        proof.put("chainId", passport.getChainId());
        proof.put("overallVerdict", overallVerdict);

        JsonNode verifierResults = objectMapper.valueToTree(verdicts);
        proof.set("verifierResults", verifierResults);

        proof.put("createdAt", now.toString());

        ProofBundle bundle = new ProofBundle();

        bundle.setId(UUID.randomUUID().toString());
        bundle.setPassportId(passport.getId());
        bundle.setPassportHash(passport.getPassportHash());
        bundle.setOverallVerdict(overallVerdict);
        bundle.setProofPayload(writeJson(proof));
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

        ObjectNode proof = parse(bundle);
        ObjectNode authorization = objectMapper.createObjectNode();

        authorization.put("safeTransactionHash", safeTxHash);
        authorization.put("eip712Digest", digest);
        authorization.put("expiry", expiry);

        authorization.put(
                "attestationTransactionHash",
                attestationTransactionHash
        );

        authorization.set(
                "signers",
                objectMapper.valueToTree(signers)
        );

        authorization.set(
                "signatures",
                objectMapper.valueToTree(signatures)
        );

        authorization.put("status", "CONFIRMED_ON_CHAIN");
        authorization.put("recordedAt", Instant.now().toString());

        proof.set("safeAuthorization", authorization);

        bundle.setProofPayload(writeJson(proof));

        return toResponse(repository.save(bundle));
    }

    @Transactional
    public ProofBundleResponse attachExecutionReceipt(
            String passportId,
            ExecutionReceiptService.ExecutionReceipt receipt
    ) {
        if (receipt == null) {
            throw new IllegalArgumentException(
                    "Execution receipt is required."
            );
        }

        ProofBundle bundle = latestEntity(passportId);
        ObjectNode proof = parse(bundle);

        ObjectNode execution = objectMapper.createObjectNode();

        execution.put(
                "transactionHash",
                receipt.transactionHash()
        );

        putNullable(
                execution,
                "blockNumber",
                receipt.blockNumber() == null
                        ? null
                        : receipt.blockNumber().toString()
        );

        execution.put("successful", receipt.successful());
        putNullable(execution, "receiptStatus", receipt.status());

        putNullable(
                execution,
                "gasUsed",
                receipt.gasUsed() == null
                        ? null
                        : receipt.gasUsed().toString()
        );

        putNullable(
                execution,
                "executedAt",
                receipt.executedAt() == null
                        ? null
                        : receipt.executedAt().toString()
        );

        execution.put(
                "outcome",
                receipt.successful()
                        ? "EXECUTED_SUCCESSFULLY"
                        : "EXECUTION_FAILED"
        );

        execution.put("recordedAt", Instant.now().toString());

        proof.set("executionReceipt", execution);

        bundle.setProofPayload(writeJson(proof));

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

    private ObjectNode parse(ProofBundle bundle) {
        try {
            JsonNode node = objectMapper.readTree(bundle.getProofPayload());

            if (node == null || !node.isObject()) {
                throw new IllegalStateException(
                        "Stored proof payload must be a JSON object."
                );
            }

            return (ObjectNode) node;

        } catch (Exception exception) {
            if (exception instanceof IllegalStateException stateException) {
                throw stateException;
            }

            throw new IllegalStateException(
                    "Stored proof payload is invalid JSON.",
                    exception
            );
        }
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Failed to serialize proof payload.",
                    exception
            );
        }
    }

    private void putNullable(
            ObjectNode object,
            String field,
            String value
    ) {
        if (value == null) {
            object.putNull(field);
        } else {
            object.put(field, value);
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
