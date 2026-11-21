
package com.truesign.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "payment_passports")
public class PaymentPassport {

    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(nullable = false, length = 66)
    private String account;

    @Column(nullable = false)
    private String mode;

    @Column(nullable = false)
    private long chainId;

    @Column(nullable = false, length = 100)
    private String purpose;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(nullable = false, length = 42)
    private String intendedRecipient;

    @Column(nullable = false, length = 42)
    private String tokenAddress;

    @Column(nullable = false, length = 20)
    private String tokenSymbol;

    @Column(nullable = false)
    private String amount;

    @Column(nullable = false)
    private String transactionTarget;

    @Column(nullable = false)
    private String transactionValueWei;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String transactionData;

    @Column(nullable = false)
    private int operation;

    @Column(nullable = false)
    private long transactionNonce;

    @Column(nullable = false, length = 66)
    private String intentHash;

    @Column(nullable = false, length = 66)
    private String transactionHash;

    @Column(nullable = false, length = 66)
    private String passportHash;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(nullable = false, length = 66)
    private String constraintsHash;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String constraintsPayload;

    public PaymentPassport() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public long getChainId() {
        return chainId;
    }

    public void setChainId(long chainId) {
        this.chainId = chainId;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getIntendedRecipient() {
        return intendedRecipient;
    }

    public void setIntendedRecipient(String intendedRecipient) {
        this.intendedRecipient = intendedRecipient;
    }

    public String getTokenAddress() {
        return tokenAddress;
    }

    public void setTokenAddress(String tokenAddress) {
        this.tokenAddress = tokenAddress;
    }

    public String getTokenSymbol() {
        return tokenSymbol;
    }

    public void setTokenSymbol(String tokenSymbol) {
        this.tokenSymbol = tokenSymbol;
    }

    public String getAmount() {
        return amount;
    }

    public void setAmount(String amount) {
        this.amount = amount;
    }

    public String getTransactionTarget() {
        return transactionTarget;
    }

    public void setTransactionTarget(String transactionTarget) {
        this.transactionTarget = transactionTarget;
    }

    public String getTransactionValueWei() {
        return transactionValueWei;
    }

    public void setTransactionValueWei(String transactionValueWei) {
        this.transactionValueWei = transactionValueWei;
    }

    public String getTransactionData() {
        return transactionData;
    }

    public void setTransactionData(String transactionData) {
        this.transactionData = transactionData;
    }

    public int getOperation() {
        return operation;
    }

    public void setOperation(int operation) {
        this.operation = operation;
    }

    public long getTransactionNonce() {
        return transactionNonce;
    }

    public void setTransactionNonce(long transactionNonce) {
        this.transactionNonce = transactionNonce;
    }

    public String getIntentHash() {
        return intentHash;
    }

    public void setIntentHash(String intentHash) {
        this.intentHash = intentHash;
    }

    public String getTransactionHash() {
        return transactionHash;
    }

    public void setTransactionHash(String transactionHash) {
        this.transactionHash = transactionHash;
    }

    public String getPassportHash() {
        return passportHash;
    }

    public void setPassportHash(String passportHash) {
        this.passportHash = passportHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getConstraintsHash() {
        return constraintsHash;
    }

    public void setConstraintsHash(String constraintsHash) {
        this.constraintsHash = constraintsHash;
    }

    public String getConstraintsPayload() {
        return constraintsPayload;
    }

    public void setConstraintsPayload(String constraintsPayload) {
        this.constraintsPayload = constraintsPayload;
    }
}
