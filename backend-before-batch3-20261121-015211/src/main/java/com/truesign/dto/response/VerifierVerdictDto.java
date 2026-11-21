
package com.truesign.dto.response;

import java.time.Instant;
import java.util.List;

public record VerifierVerdictDto(

        String verifierName,

        boolean passed,

        String status,

        String summary,

        List<AnomalyDto> anomalies,

        Instant checkedAt

) {}
