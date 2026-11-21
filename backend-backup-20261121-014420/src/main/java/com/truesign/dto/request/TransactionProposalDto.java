
package com.truesign.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record TransactionProposalDto(

        @NotBlank(message = "Transaction target is required")
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$")
        String to,

        @NotBlank(message = "Transaction value is required")
        @Pattern(regexp = "^[0-9]+$")
        String valueWei,

        @NotBlank(message = "Transaction calldata is required")
        @Pattern(regexp = "^0x([a-fA-F0-9]{2})*$")
        String data,

        @Min(value = 0)
        int operation,

        @Min(value = 0)
        long nonce

) {}
