package com.truesign.dto.response;

public record SnapshotDto(
        String id,
        String passportId,
        String snapshotType,
        long capturedAtEpochMs,
        String blockNumber,
        String accountAddress,
        String intendedRecipient,
        String tokenAddress,
        String targetContractAddress,
        String accountNativeBalanceWei,
        String recipientNativeBalanceWei,
        String accountTokenBalance,
        String recipientTokenBalance,
        String targetCodeHash,
        boolean payeeRegistered,
        boolean payeeReady,
        long readyAtEpochSeconds,
        long remainingCooldownSeconds
) {}