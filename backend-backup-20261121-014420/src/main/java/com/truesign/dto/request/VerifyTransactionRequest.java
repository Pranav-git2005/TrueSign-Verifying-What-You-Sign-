
package com.truesign.dto.request;

import jakarta.validation.constraints.NotBlank;

public record VerifyTransactionRequest(

        @NotBlank(message = "Passport ID is required")
        String passportId

) {}
