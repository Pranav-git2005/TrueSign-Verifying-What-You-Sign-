package com.truesign.blockchain;

import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import com.truesign.entity.VerificationRecord;
import com.truesign.repository.PaymentPassportRepository;
import com.truesign.repository.VerificationRecordRepository;
import com.truesign.service.ProofBundleService;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializer;
import com.google.gson.reflect.TypeToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.DynamicArray;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.tx.RawTransactionManager;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.response.PollingTransactionReceiptProcessor;
import org.web3j.utils.Numeric;


import java.math.BigInteger;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class TrueSignGuardService {

    private final Web3j web3j;
    private final String guardAddress;
    private final String submitterPrivateKey;

    private final PaymentPassportRepository passportRepository;
    private final VerificationRecordRepository verificationRepository;
    private final SafeTransactionService safeTransactionService;
    private final VerifierQuorumService quorumService;
    private final ProofBundleService proofBundleService;

    private final Gson gson;

    public TrueSignGuardService(
            Web3j web3j,
            PaymentPassportRepository passportRepository,
            VerificationRecordRepository verificationRepository,
            SafeTransactionService safeTransactionService,
            VerifierQuorumService quorumService,
            ProofBundleService proofBundleService,
            @Value("${truesign.contracts.guard-address}") String guardAddress,
            @Value("${truesign.blockchain.submitter-private-key:}") String submitterPrivateKey
    ) {
        this.web3j = web3j;
        this.passportRepository = passportRepository;
        this.verificationRepository = verificationRepository;
        this.safeTransactionService = safeTransactionService;
        this.quorumService = quorumService;
        this.proofBundleService = proofBundleService;
        this.guardAddress = guardAddress;
        this.submitterPrivateKey = submitterPrivateKey;

        this.gson = new GsonBuilder()
                .registerTypeAdapter(
                        Instant.class,
                        (JsonDeserializer<Instant>) (json, type, context) ->
                                Instant.parse(json.getAsString())
                )
                .create();
    }

    public record GuardAttestationResult(
            String passportId,
            String safeTransactionHash,
            String digest,
            long expiry,
            List<String> signers,
            String attestationTransactionHash,
            String status
    ) {}

    public GuardAttestationResult authorizePassport(
            String passportId
    ) throws Exception {

        if (submitterPrivateKey == null || submitterPrivateKey.isBlank()) {
            throw new IllegalStateException(
                    "TRUESIGN_SUBMITTER_PRIVATE_KEY is not configured."
            );
        }

        PaymentPassport passport = passportRepository.findById(passportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Passport not found: " + passportId
                ));

        if (!"GREEN".equalsIgnoreCase(passport.getStatus())
                && !"CREATED".equalsIgnoreCase(passport.getStatus())) {
            throw new SecurityException(
                    "Passport is not eligible for Guard authorization."
            );
        }

        List<VerificationRecord> records =
                verificationRepository.findByPassportIdOrderByCreatedAtDesc(
                        passportId
                );

        if (records.isEmpty()) {
            throw new IllegalStateException(
                    "Run transaction verification before requesting attestation."
            );
        }

        VerificationRecord latest = records.get(0);

        if (!"GREEN".equalsIgnoreCase(latest.getOverallVerdict())) {
            throw new SecurityException(
                    "Only a GREEN verification result can be authorized."
            );
        }

        java.lang.reflect.Type verdictType =
                new TypeToken<List<VerifierVerdictDto>>() {}.getType();

        List<VerifierVerdictDto> verdicts =
                gson.fromJson(latest.getResultsPayload(), verdictType);

        if (verdicts == null || verdicts.size() != 3) {
            throw new SecurityException(
                    "Three verifier results are required."
            );
        }

        // Calculate the exact Safe transaction hash.
        String safeTxHash =
                safeTransactionService.calculateSafeTransactionHash(passport);

        // 30-minute validity, within Guard's one-hour maximum.
        long expiry = Instant.now().getEpochSecond() + 1800L;

        // Generate and verify the 2-of-3 signatures.
        VerifierQuorumService.QuorumAttestation quorum =
                quorumService.createQuorum(
                        verdicts,
                        latest.getOverallVerdict(),
                        safeTxHash,
                        expiry
                );

        // Submit the two signatures to the deployed Guard.
        String attestationTxHash = submitAttestation(
                safeTxHash,
                expiry,
                quorum.signatures()
        );

        // Persist the authorization proof.
        proofBundleService.attachAttestation(
                passportId,
                safeTxHash,
                quorum.digest(),
                expiry,
                quorum.signers(),
                quorum.signatures(),
                attestationTxHash
        );

        return new GuardAttestationResult(
                passportId,
                safeTxHash,
                quorum.digest(),
                expiry,
                quorum.signers(),
                attestationTxHash,
                "ATTESTATION_SUBMITTED"
        );
    }

    private String submitAttestation(
            String safeTxHash,
            long expiry,
            List<String> signatures
    ) throws Exception {

        if (signatures == null || signatures.size() != 2) {
            throw new SecurityException("Exactly two signatures are required.");
        }

        List<DynamicBytes> signatureBytes = signatures.stream()
                .map(value -> new DynamicBytes(
                        Numeric.hexStringToByteArray(value)
                ))
                .toList();

        DynamicArray<DynamicBytes> signatureArray =
                new DynamicArray<>(DynamicBytes.class, signatureBytes);

        Function function = new Function(
                "submitAttestation",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(safeTxHash)),
                        new Uint256(BigInteger.valueOf(expiry)),
                        signatureArray
                ),
                List.of()
        );

        String calldata = FunctionEncoder.encode(function);

        Credentials credentials = Credentials.create(
                Numeric.cleanHexPrefix(submitterPrivateKey.trim())
        );

        BigInteger chainId = web3j.ethChainId()
                .send()
                .getChainId();

        RawTransactionManager manager =
                new RawTransactionManager(
                        web3j,
                        credentials,
                        chainId.longValueExact()
                );

        BigInteger gasPrice = web3j.ethGasPrice()
                .send()
                .getGasPrice();

        EthSendTransaction response = manager.sendTransaction(
                gasPrice,
                BigInteger.valueOf(600_000L),
                guardAddress,
                calldata,
                BigInteger.ZERO
        );

        if (response.hasError()) {
            throw new IllegalStateException(
                    "Guard attestation submission failed: "
                            + response.getError().getMessage()
            );
        }

        String transactionHash = response.getTransactionHash();

        if (transactionHash == null || transactionHash.isBlank()) {
            throw new IllegalStateException(
                    "Guard submission returned no transaction hash."
            );
        }

        TransactionReceipt receipt =
                new PollingTransactionReceiptProcessor(
                        web3j,
                        1000,
                        60
                ).waitForTransactionReceipt(transactionHash);

        if (!"0x1".equalsIgnoreCase(receipt.getStatus())) {
            throw new IllegalStateException(
                    "Guard rejected the attestation transaction. Receipt status: "
                            + receipt.getStatus()
            );
        }

        return transactionHash;
    }
}