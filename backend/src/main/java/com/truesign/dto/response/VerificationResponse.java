
package com.truesign.dto.response;

import java.time.Instant;
import java.util.List;

public record VerificationResponse(
        String passportId,
        String overallVerdict,
        int passedCount,
        int totalVerifiers,
        String trafficLight,
        List<VerifierVerdictDto> verifierResults,
        List<AnomalyDto> anomalies,
        ProofBundleResponse proofBundle,
        Instant verifiedAt
) {}
