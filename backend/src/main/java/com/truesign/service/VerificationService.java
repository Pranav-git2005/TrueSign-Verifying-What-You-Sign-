
package com.truesign.service;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.truesign.dto.response.AnomalyDto;
import com.truesign.dto.response.ProofBundleResponse;
import com.truesign.dto.response.VerificationResponse;
import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import com.truesign.entity.VerificationRecord;
import com.truesign.repository.PaymentPassportRepository;
import com.truesign.repository.VerificationRecordRepository;
import com.truesign.verifier.VerificationOrchestrator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class VerificationService {

    private final PaymentPassportRepository passportRepository;
    private final VerificationRecordRepository verificationRepository;
    private final VerificationOrchestrator orchestrator;
    private final AnomalyService anomalyService;
    private final ProofBundleService proofBundleService;
    private final Gson gson;

    public VerificationService(
            PaymentPassportRepository passportRepository,
            VerificationRecordRepository verificationRepository,
            VerificationOrchestrator orchestrator,
            AnomalyService anomalyService,
            ProofBundleService proofBundleService) {

        this.passportRepository = passportRepository;
        this.verificationRepository = verificationRepository;
        this.orchestrator = orchestrator;
        this.anomalyService = anomalyService;
        this.proofBundleService = proofBundleService;

        JsonSerializer<Instant> instantSerializer =
                new JsonSerializer<Instant>() {
                    @Override
                    public JsonElement serialize(
                            Instant src,
                            java.lang.reflect.Type typeOfSrc,
                            JsonSerializationContext context) {

                        return new JsonPrimitive(src.toString());
                    }
                };

        this.gson = new GsonBuilder()
                .registerTypeAdapter(
                        Instant.class,
                        instantSerializer
                )
                .create();
    }

    @Transactional
    public VerificationResponse verifyPassport(String passportId) {

        if (passportId == null || passportId.isBlank()) {
            throw new IllegalArgumentException(
                    "Passport ID cannot be empty"
            );
        }

        // 1. Retrieve the Payment Passport.
        PaymentPassport passport = passportRepository.findById(passportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment Passport not found: " + passportId
                ));

        // 2. Execute all registered verifiers.
        List<VerifierVerdictDto> verdicts =
                orchestrator.verifyAll(passport);

        // 3. Collect all detected anomalies.
        List<AnomalyDto> anomalies =
                anomalyService.collectAnomalies(verdicts);

        // 4. Calculate ONE authoritative verdict.
        String overallVerdict =
                orchestrator.calculateOverallVerdict(verdicts);

        // The traffic light must agree with the overall verdict.
        String trafficLight = overallVerdict;

        int passedCount = (int) verdicts.stream()
                .filter(VerifierVerdictDto::passed)
                .count();

        Instant verifiedAt = Instant.now();

        // 5. Generate Proof Bundle using the authoritative verdict.
        ProofBundleResponse proofBundle =
                proofBundleService.createProofBundle(
                        passport,
                        verdicts,
                        overallVerdict
                );

        // 6. Persist verification history.
        VerificationRecord record = new VerificationRecord();

        record.setId(java.util.UUID.randomUUID().toString());
        record.setPassportId(passportId);
        record.setOverallVerdict(overallVerdict);
        record.setPassedCount(passedCount);
        record.setTotalVerifiers(verdicts.size());
        record.setResultsPayload(gson.toJson(verdicts));
        record.setCreatedAt(verifiedAt);

        verificationRepository.save(record);

        // 7. Return a consistent API response.
        return new VerificationResponse(
                passportId,
                overallVerdict,
                passedCount,
                verdicts.size(),
                trafficLight,
                verdicts,
                anomalies,
                proofBundle,
                verifiedAt
        );
    }
}
