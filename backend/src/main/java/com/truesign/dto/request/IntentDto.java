
package com.truesign.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record IntentDto(

        @NotBlank(message = "Payment purpose is required")
        @Size(max = 100)
        String purpose,

        @NotBlank(message = "Payment summary is required")
        @Size(max = 500)
        String summary,

        @NotBlank(message = "Intended recipient is required")
        @Pattern(
                regexp = "^0x[a-fA-F0-9]{40}$",
                message = "Recipient must be a valid Ethereum address"
        )
        String recipient,

        @NotBlank(message = "Token address is required")
        @Pattern(
                regexp = "^0x[a-fA-F0-9]{40}$",
                message = "Token address must be valid"
        )
        String tokenAddress,

        @NotBlank(message = "Token symbol is required")
        @Size(max = 20)
        String tokenSymbol,

        @NotBlank(message = "Payment amount is required")
        @Pattern(
                regexp = "^[0-9]+(\\.[0-9]+)?$",
                message = "Amount must be a positive decimal number"
        )
        String amount

) {}
