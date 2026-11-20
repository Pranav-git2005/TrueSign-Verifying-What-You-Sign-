
package com.truesign.service;

import com.truesign.dto.response.AnomalyDto;
import com.truesign.dto.response.VerifierVerdictDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AnomalyService {

    public List<AnomalyDto> collectAnomalies(
            List<VerifierVerdictDto> verdicts) {

        List<AnomalyDto> anomalies = new ArrayList<>();

        if (verdicts == null) {
            return anomalies;
        }

        for (VerifierVerdictDto verdict : verdicts) {

            if (verdict == null || verdict.anomalies() == null) {
                continue;
            }

            anomalies.addAll(verdict.anomalies());
        }

        return anomalies;
    }

    public long countBySeverity(
            List<AnomalyDto> anomalies,
            String severity) {

        if (anomalies == null || severity == null) {
            return 0;
        }

        return anomalies.stream()
                .filter(anomaly ->
                        anomaly.severity() != null &&
                                anomaly.severity().equalsIgnoreCase(severity))
                .count();
    }

    public boolean hasCriticalAnomaly(
            List<AnomalyDto> anomalies) {

        return countBySeverity(anomalies, "CRITICAL") > 0;
    }

    public String determineTrafficLight(
            List<VerifierVerdictDto> verdicts) {

        List<AnomalyDto> anomalies = collectAnomalies(verdicts);

        if (hasCriticalAnomaly(anomalies)) {
            return "RED";
        }

        if (!anomalies.isEmpty()) {
            return "AMBER";
        }

        return "GREEN";
    }
}
