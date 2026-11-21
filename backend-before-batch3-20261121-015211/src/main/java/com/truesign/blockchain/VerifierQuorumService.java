package com.truesign.blockchain;

import com.truesign.dto.response.VerifierVerdictDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Coordinates three verifier signing identities.
 *
 * All three verification modules must return GREEN before
 * signatures are generated.
 *
 * TrueSignGuard requires exactly two distinct registered
 * verifier signatures in ascending signer-address order.
 *
 * This is a local MVP signing coordinator. It does not
 * provide independent operator infrastructure.
 */
@Service
public class VerifierQuorumService {

    private static final String INTENT_VERIFIER =
            "INTENT_VERIFIER";

    private static final String POLICY_VERIFIER =
            "POLICY_VERIFIER";

    private static final String SIMULATION_VERIFIER =
            "SIMULATION_VERIFIER";

    private static final int REQUIRED_QUORUM = 2;

    private final Eip712Service eip712Service;

    private final String intentPrivateKey;
    private final String policyPrivateKey;
    private final String simulationPrivateKey;

    public VerifierQuorumService(
            Eip712Service eip712Service,
            @Value("${truesign.verifiers.intent-private-key:}")
            String intentPrivateKey,
            @Value("${truesign.verifiers.policy-private-key:}")
            String policyPrivateKey,
            @Value("${truesign.verifiers.simulation-private-key:}")
            String simulationPrivateKey
    ) {
        this.eip712Service = eip712Service;
        this.intentPrivateKey = intentPrivateKey;
        this.policyPrivateKey = policyPrivateKey;
        this.simulationPrivateKey = simulationPrivateKey;
    }

    /**
     * Result prepared for the TrueSignGuard contract.
     *
     * signatures contains exactly two signatures, sorted
     * by recovered signer address.
     */
    public record QuorumAttestation(
            String safeTxHash,
            String digest,
            long expiry,
            int requiredQuorum,
            List<String> signers,
            List<String> signatures
    ) {}

    /**
     * Generate the 2-of-3 attestation.
     *
     * Security requirements:
     * 1. Overall verification must be GREEN.
     * 2. Exactly three verifier results must exist.
     * 3. All three named verifiers must pass.
     * 4. Each verifier must have a separate private key.
     * 5. All signers must be registered in TrueSignGuard.
     * 6. The Java EIP-712 digest must match Solidity.
     * 7. Two distinct signatures are selected and sorted.
     */
    public QuorumAttestation createQuorum(
            List<VerifierVerdictDto> verdicts,
            String overallVerdict,
            String safeTxHash,
            long expiry
    ) throws Exception {

        if (!"GREEN".equalsIgnoreCase(overallVerdict)) {
            throw new SecurityException(
                    "Attestation denied: overall verification is not GREEN."
            );
        }

        validateVerifierResults(verdicts);

        requireKey(intentPrivateKey, INTENT_VERIFIER);
        requireKey(policyPrivateKey, POLICY_VERIFIER);
        requireKey(simulationPrivateKey, SIMULATION_VERIFIER);

        // Confirm the EIP-712 digest against the deployed Guard.
        boolean digestMatches =
                eip712Service.verifyDigestAgainstContract(
                        safeTxHash,
                        expiry
                );

        if (!digestMatches) {
            throw new SecurityException(
                    "Java EIP-712 digest does not match TrueSignGuard."
            );
        }

        List<Eip712Service.AttestationSignature> generated =
                new ArrayList<>();

        // Identity 1: Intent verifier.
        generated.add(eip712Service.signAttestation(
                safeTxHash,
                expiry,
                intentPrivateKey
        ));

        // Identity 2: Policy verifier.
        generated.add(eip712Service.signAttestation(
                safeTxHash,
                expiry,
                policyPrivateKey
        ));

        // Identity 3: Simulation verifier.
        generated.add(eip712Service.signAttestation(
                safeTxHash,
                expiry,
                simulationPrivateKey
        ));

        // Ensure all three keys represent distinct registered signers.
        Set<String> uniqueSigners = new HashSet<>();

        for (Eip712Service.AttestationSignature signature : generated) {
            String signer = signature.signer().toLowerCase();

            if (!uniqueSigners.add(signer)) {
                throw new SecurityException(
                        "Verifier identities must use three distinct private keys."
                );
            }

            if (!eip712Service.isRegisteredVerifier(signature.signer())) {
                throw new SecurityException(
                        "Unregistered verifier signer: " + signature.signer()
                );
            }
        }

        // Select two distinct signers deterministically.
        List<Eip712Service.AttestationSignature> selected =
                generated.stream()
                        .sorted(Comparator.comparing(
                                item -> item.signer().toLowerCase()
                        ))
                        .limit(REQUIRED_QUORUM)
                        .toList();

        // TrueSignGuard requires strictly ascending addresses.
        selected = eip712Service.sortSignatures(selected);

        String expectedDigest =
                selected.get(0).digest();

        List<String> signers = new ArrayList<>();
        List<String> signatures = new ArrayList<>();

        for (Eip712Service.AttestationSignature item : selected) {

            if (!expectedDigest.equalsIgnoreCase(item.digest())) {
                throw new SecurityException(
                        "Verifier signatures do not share the same EIP-712 digest."
                );
            }

            // Recover signer again before returning the quorum.
            String recovered = eip712Service.recoverSigner(
                    item.digest(),
                    item.signature()
            );

            if (!recovered.equalsIgnoreCase(item.signer())) {
                throw new SecurityException(
                        "Signature recovery validation failed."
                );
            }

            signers.add(item.signer());
            signatures.add(item.signature());
        }

        if (signatures.size() != REQUIRED_QUORUM) {
            throw new SecurityException(
                    "Exactly two signatures are required."
            );
        }

        return new QuorumAttestation(
                safeTxHash,
                expectedDigest,
                expiry,
                REQUIRED_QUORUM,
                List.copyOf(signers),
                List.copyOf(signatures)
        );
    }

    private void validateVerifierResults(
            List<VerifierVerdictDto> verdicts
    ) {

        if (verdicts == null || verdicts.size() != 3) {
            throw new SecurityException(
                    "Exactly three verifier results are required."
            );
        }

        requireGreen(verdicts, INTENT_VERIFIER);
        requireGreen(verdicts, POLICY_VERIFIER);
        requireGreen(verdicts, SIMULATION_VERIFIER);
    }

    private void requireGreen(
            List<VerifierVerdictDto> verdicts,
            String expectedName
    ) {

        List<VerifierVerdictDto> matches = verdicts.stream()
                .filter(item ->
                        item != null
                        && expectedName.equalsIgnoreCase(item.verifierName())
                )
                .toList();

        if (matches.size() != 1) {
            throw new SecurityException(
                    "Missing or duplicate verifier result: " + expectedName
            );
        }

        VerifierVerdictDto verdict = matches.get(0);

        if (!verdict.passed()
                || !"GREEN".equalsIgnoreCase(verdict.status())
                || (verdict.anomalies() != null
                    && !verdict.anomalies().isEmpty())) {

            throw new SecurityException(
                    "Verifier did not approve the transaction: " + expectedName
            );
        }
    }

    private void requireKey(String key, String verifierName) {

        if (key == null || key.isBlank()) {
            throw new IllegalStateException(
                    "Missing private key configuration for " + verifierName
            );
        }
    }
}