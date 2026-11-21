package com.truesign.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "passport_snapshots")
public class PassportSnapshot {

    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(nullable = false, length = 36)
    private String passportId;

    @Column(nullable = false, length = 40)
    private String snapshotType;

    @Column(nullable = false)
    private long capturedAtEpochMs;

    @Column(nullable = false)
    private String blockNumber;

    @Column(nullable = false, length = 42)
    private String accountAddress;

    @Column(nullable = false, length = 42)
    private String intendedRecipient;

    @Column(nullable = false, length = 42)
    private String tokenAddress;

    @Column(nullable = false, length = 42)
    private String targetContractAddress;

    @Column(nullable = false)
    private String accountNativeBalanceWei;

    @Column(nullable = false)
    private String recipientNativeBalanceWei;

    @Column(nullable = false)
    private String accountTokenBalance;

    @Column(nullable = false)
    private String recipientTokenBalance;

    @Column(nullable = false, length = 66)
    private String targetCodeHash;

    @Column(nullable = false)
    private boolean payeeRegistered;

    @Column(nullable = false)
    private boolean payeeReady;

    @Column(nullable = false)
    private long readyAtEpochSeconds;

    @Column(nullable = false)
    private long remainingCooldownSeconds;

    public PassportSnapshot() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPassportId() { return passportId; }
    public void setPassportId(String passportId) { this.passportId = passportId; }

    public String getSnapshotType() { return snapshotType; }
    public void setSnapshotType(String snapshotType) { this.snapshotType = snapshotType; }

    public long getCapturedAtEpochMs() { return capturedAtEpochMs; }
    public void setCapturedAtEpochMs(long value) { this.capturedAtEpochMs = value; }

    public String getBlockNumber() { return blockNumber; }
    public void setBlockNumber(String blockNumber) { this.blockNumber = blockNumber; }

    public String getAccountAddress() { return accountAddress; }
    public void setAccountAddress(String value) { this.accountAddress = value; }

    public String getIntendedRecipient() { return intendedRecipient; }
    public void setIntendedRecipient(String value) { this.intendedRecipient = value; }

    public String getTokenAddress() { return tokenAddress; }
    public void setTokenAddress(String value) { this.tokenAddress = value; }

    public String getTargetContractAddress() { return targetContractAddress; }
    public void setTargetContractAddress(String value) { this.targetContractAddress = value; }

    public String getAccountNativeBalanceWei() { return accountNativeBalanceWei; }
    public void setAccountNativeBalanceWei(String value) { this.accountNativeBalanceWei = value; }

    public String getRecipientNativeBalanceWei() { return recipientNativeBalanceWei; }
    public void setRecipientNativeBalanceWei(String value) { this.recipientNativeBalanceWei = value; }

    public String getAccountTokenBalance() { return accountTokenBalance; }
    public void setAccountTokenBalance(String value) { this.accountTokenBalance = value; }

    public String getRecipientTokenBalance() { return recipientTokenBalance; }
    public void setRecipientTokenBalance(String value) { this.recipientTokenBalance = value; }

    public String getTargetCodeHash() { return targetCodeHash; }
    public void setTargetCodeHash(String value) { this.targetCodeHash = value; }

    public boolean isPayeeRegistered() { return payeeRegistered; }
    public void setPayeeRegistered(boolean value) { this.payeeRegistered = value; }

    public boolean isPayeeReady() { return payeeReady; }
    public void setPayeeReady(boolean value) { this.payeeReady = value; }

    public long getReadyAtEpochSeconds() { return readyAtEpochSeconds; }
    public void setReadyAtEpochSeconds(long value) { this.readyAtEpochSeconds = value; }

    public long getRemainingCooldownSeconds() { return remainingCooldownSeconds; }
    public void setRemainingCooldownSeconds(long value) { this.remainingCooldownSeconds = value; }
}