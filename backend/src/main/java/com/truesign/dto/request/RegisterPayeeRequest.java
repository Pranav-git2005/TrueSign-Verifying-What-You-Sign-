package com.truesign.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RegisterPayeeRequest(

        @NotBlank
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$")
        String account,

        @NotBlank
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$")
        String payee,

        @NotBlank
        @Pattern(regexp = "^0x[a-fA-F0-9]{64}$")
        String transactionHash

) {}