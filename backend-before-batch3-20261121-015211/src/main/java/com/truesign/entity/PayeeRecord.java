package com.truesign.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "registered_payees",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_payee_account_payee",
        columnNames = {"account_address", "payee_address"}
    )
)
public class PayeeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "account_address", nullable = false, length = 42)
    private String account;

    @Column(name = "payee_address", nullable = false, length = 42)
    private String payee;

    @Column(name = "transaction_hash", nullable = false, length = 66)
    private String transactionHash;

    @Column(name = "activation_timestamp", nullable = false)
    private String activationTimestamp;

    @Column(nullable = false)
    private Instant createdAt;

    public PayeeRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAccount() { return account; }
    public void setAccount(String account) { this.account = account; }

    public String getPayee() { return payee; }
    public void setPayee(String payee) { this.payee = payee; }

    public String getTransactionHash() { return transactionHash; }
    public void setTransactionHash(String transactionHash) {
        this.transactionHash = transactionHash;
    }

    public String getActivationTimestamp() { return activationTimestamp; }
    public void setActivationTimestamp(String activationTimestamp) {
        this.activationTimestamp = activationTimestamp;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}