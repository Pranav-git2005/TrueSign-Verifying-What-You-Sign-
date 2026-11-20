
package com.truesign.dto.response;

import java.time.Instant;

public record PassportResponse(

        String passportId,

        String account,

        String mode,

        long chainId,

        String purpose,

        String recipient,

        String tokenSymbol,

        String amount,

        String intentHash,

        String transactionHash,

        String passportHash,

        Instant createdAt,

        Instant expiresAt,

        String status

) {}
