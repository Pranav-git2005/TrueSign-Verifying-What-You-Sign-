
package com.truesign.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "verification_records")
public class VerificationRecord {

    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(nullable = false, length = 36)
    private String passportId;

    @Column(nullable = false, length = 20)
    private String overallVerdict;

    @Column(nullable = false)
    private int passedCount;

    @Column(nullable = false)
    private int totalVerifiers;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String resultsPayload;

    @Column(nullable = false)
    private Instant createdAt;

    public VerificationRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPassportId() { return passportId; }
    public void setPassportId(String passportId) {
        this.passportId = passportId;
    }

    public String getOverallVerdict() { return overallVerdict; }
    public void setOverallVerdict(String overallVerdict) {
        this.overallVerdict = overallVerdict;
    }

    public int getPassedCount() { return passedCount; }
    public void setPassedCount(int passedCount) {
        this.passedCount = passedCount;
    }

    public int getTotalVerifiers() { return totalVerifiers; }
    public void setTotalVerifiers(int totalVerifiers) {
        this.totalVerifiers = totalVerifiers;
    }

    public String getResultsPayload() { return resultsPayload; }
    public void setResultsPayload(String resultsPayload) {
        this.resultsPayload = resultsPayload;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
