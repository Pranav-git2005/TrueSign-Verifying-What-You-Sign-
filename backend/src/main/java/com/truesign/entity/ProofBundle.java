
package com.truesign.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "proof_bundles")
public class ProofBundle {

    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(nullable = false, length = 36)
    private String passportId;

    @Column(nullable = false, length = 66)
    private String passportHash;

    @Column(nullable = false, length = 20)
    private String overallVerdict;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String proofPayload;

    @Column(nullable = false)
    private Instant createdAt;

    public ProofBundle() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPassportId() { return passportId; }
    public void setPassportId(String passportId) {
        this.passportId = passportId;
    }

    public String getPassportHash() { return passportHash; }
    public void setPassportHash(String passportHash) {
        this.passportHash = passportHash;
    }

    public String getOverallVerdict() { return overallVerdict; }
    public void setOverallVerdict(String overallVerdict) {
        this.overallVerdict = overallVerdict;
    }

    public String getProofPayload() { return proofPayload; }
    public void setProofPayload(String proofPayload) {
        this.proofPayload = proofPayload;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
