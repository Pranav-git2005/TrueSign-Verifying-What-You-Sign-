
package com.truesign.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ConstraintsDto(

        @NotBlank(message = "Maximum amount is required")
        @Pattern(regexp = "^[0-9]+(\\.[0-9]+)?$")
        String maxAmount,

        @NotBlank(message = "Allowed target is required")
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$")
        String allowedTarget,

        @Pattern(regexp = "^0x([a-fA-F0-9]{8})?$")
        String allowedSelector,

        @Pattern(regexp = "^(0x)?([a-fA-F0-9]{64})?$")
        String expectedCodeHash,

        boolean allowDelegateCall,

        boolean allowUnlimitedApproval,

        @NotBlank(message = "Daily limit is required")
        @Pattern(regexp = "^[0-9]+(\\.[0-9]+)?$")
        String dailyLimit,

        @Min(value = 0, message = "Cooldown cannot be negative")
        long cooldownSeconds

) {}
