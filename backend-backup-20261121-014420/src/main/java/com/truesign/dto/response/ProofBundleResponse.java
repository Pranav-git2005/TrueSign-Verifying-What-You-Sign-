
package com.truesign.dto.response;

import java.time.Instant;

public record ProofBundleResponse(
        String proofId,
        String passportId,
        String passportHash,
        String overallVerdict,
        String proofPayload,
        Instant createdAt
) {}
