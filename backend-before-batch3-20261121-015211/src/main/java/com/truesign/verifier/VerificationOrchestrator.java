package com.truesign.verifier;

import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class VerificationOrchestrator {

    private static final int REQUIRED_VERIFIERS = 3;

    private final List<Verifier> verifiers;

    public VerificationOrchestrator(List<Verifier> verifiers) {
        this.verifiers = verifiers;
    }

    public List<VerifierVerdictDto> verifyAll(PaymentPassport passport) {
        List<VerifierVerdictDto> results = new ArrayList<>();

        for (Verifier verifier : verifiers) {
            try {
                VerifierVerdictDto result = verifier.verify(passport);

                results.add(result == null
                        ? failed(verifier.getVerifierName(), "Empty verifier result")
                        : result);

            } catch (Exception exception) {
                results.add(failed(
                        verifier.getVerifierName(),
                        exception.getMessage()
                ));
            }
        }

        return results;
    }

    private VerifierVerdictDto failed(String name, String message) {
        return new VerifierVerdictDto(
                name,
                false,
                "RED",
                "Verifier failed: " + message,
                List.of(),
                Instant.now()
        );
    }

    public String calculateOverallVerdict(List<VerifierVerdictDto> results) {

        if (results == null
                || results.size() != REQUIRED_VERIFIERS
                || results.stream().anyMatch(r -> r == null)) {
            return "INCONCLUSIVE";
        }

        if (results.stream().anyMatch(r ->
                "INCONCLUSIVE".equalsIgnoreCase(r.status()))) {
            return "INCONCLUSIVE";
        }

        if (results.stream().anyMatch(r -> !r.passed())) {
            return "RED";
        }

        boolean critical = results.stream()
                .filter(r -> r.anomalies() != null)
                .flatMap(r -> r.anomalies().stream())
                .anyMatch(a -> "CRITICAL".equalsIgnoreCase(a.severity()));

        if (critical || results.stream().anyMatch(r ->
                "RED".equalsIgnoreCase(r.status()))) {
            return "RED";
        }

        boolean warning = results.stream().anyMatch(r ->
                "AMBER".equalsIgnoreCase(r.status())
                || (r.anomalies() != null && !r.anomalies().isEmpty())
        );

        if (warning) {
            return "AMBER";
        }

        return results.stream().allMatch(r ->
                r.passed() && "GREEN".equalsIgnoreCase(r.status()))
                ? "GREEN"
                : "INCONCLUSIVE";
    }
}