
package com.truesign.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;

public record CreatePassportRequest(

        @NotBlank(message = "Account address is required")
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$")
        String account,

        @NotBlank(message = "Mode is required")
        @Pattern(regexp = "^(SAFE_MULTISIG|SINGLE_KEY_EOA)$")
        String mode,

        @Min(value = 1, message = "Chain ID must be positive")
        long chainId,

        @NotNull(message = "Passport expiry is required")
        @Future(message = "Passport expiry must be in the future")
        Instant expiresAt,

        @NotNull
        @Valid
        IntentDto intent,

        @NotNull
        @Valid
        ConstraintsDto constraints,

        @NotNull
        @Valid
        TransactionProposalDto transaction

) {}
