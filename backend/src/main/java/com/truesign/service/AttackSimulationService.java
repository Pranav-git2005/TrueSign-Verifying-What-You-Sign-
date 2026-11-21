package com.truesign.service;

import com.truesign.dto.request.SimulationRequest;
import com.truesign.dto.response.SimulationRunResponse;
import com.truesign.dto.response.SimulationScenarioResult;
import com.truesign.entity.PaymentPassport;
import com.truesign.blockchain.SafeTransactionService;
import com.truesign.repository.PaymentPassportRepository;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class AttackSimulationService {
    private static final Set<String> ALLOWED_SCENARIOS = Set.of(
            "AMOUNT_MANIPULATION", "UNAUTHORIZED_TARGET", "SELECTOR_MANIPULATION",
            "NONCE_REPLAY", "RECIPIENT_MANIPULATION", "UNAUTHORIZED_EXECUTION",
            "GUARD_BYPASS", "BASELINE_EVM_CALL"
    );

    private final PaymentPassportRepository passports;
    private final Web3j web3j;
    private final SafeTransactionService safeTransactionService;

    public AttackSimulationService(PaymentPassportRepository passports, Web3j web3j, SafeTransactionService safeTransactionService) {
        this.passports = passports;
        this.web3j = web3j;
        this.safeTransactionService = safeTransactionService;
    }

    public SimulationRunResponse run(String passportId, SimulationRequest request) {
        PaymentPassport passport = passports.findById(passportId)
                .orElseThrow(() -> new IllegalArgumentException("Payment Passport not found: " + passportId));
        List<SimulationScenarioResult> results = new ArrayList<>();
        List<String> requested = request == null ? new SimulationRequest(null).scenarios() : request.scenarios();
        for (String raw : requested) {
            String scenario = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
            if (!ALLOWED_SCENARIOS.contains(scenario)) {
                results.add(item(scenario, "INCONCLUSIVE", "Unsupported scenario",
                        "This scenario is not supported by this simulation build.", "Known scenario", scenario));
                continue;
            }
            results.add(switch (scenario) {
                case "AMOUNT_MANIPULATION" -> amountScenario(passport);
                case "UNAUTHORIZED_TARGET" -> targetScenario(passport);
                case "SELECTOR_MANIPULATION" -> selectorScenario(passport);
                case "NONCE_REPLAY" -> nonceScenario(passport);
                case "RECIPIENT_MANIPULATION" -> inconclusive(scenario, "Recipient manipulation",
                        "The stored transaction's recipient cannot be decoded safely without the token/target ABI. No recipient mutation was sent.");
                case "UNAUTHORIZED_EXECUTION" -> inconclusive(scenario, "Unauthorized execution",
                        "Owner signatures and Safe authorization are not persisted as an executable test fixture, so authorization cannot be proven here.");
                case "GUARD_BYPASS" -> inconclusive(scenario, "Safe Guard bypass",
                        "This endpoint does not execute a Safe transaction through the Safe Guard path. Guard bypass is not tested.");
                case "BASELINE_EVM_CALL" -> baselineCall(passport);
                default -> inconclusive(scenario, scenario, "Scenario could not be evaluated.");
            });
        }
        int blocked = (int) results.stream().filter(r -> "BLOCKED".equals(r.status())).count();
        int passed = (int) results.stream().filter(r -> "PASS".equals(r.status())).count();
        int vulnerable = (int) results.stream().filter(r -> "VULNERABLE".equals(r.status())).count();
        int inconclusive = (int) results.stream().filter(r -> "INCONCLUSIVE".equals(r.status())).count();
        return new SimulationRunResponse(passportId, Instant.now(), "READ_ONLY_POLICY_AND_RPC_CHECKS",
                blocked, passed, vulnerable, inconclusive, List.copyOf(results),
                "Read-only simulation. No transaction was signed, broadcast, or submitted to a Safe. A BLOCKED result means the modeled policy check rejected the synthetic mutation; it is not proof of on-chain Guard enforcement.");
    }

    private SimulationScenarioResult amountScenario(PaymentPassport p) {
        Map<String, String> c = constraints(p.getConstraintsPayload());
        String maximum = c.get("maxAmount");
        if (!decimal(maximum) || !decimal(p.getAmount()))
            return inconclusive("AMOUNT_MANIPULATION", "Amount manipulation", "A valid stored amount and maxAmount constraint are required.");
        BigDecimal attempted = new BigDecimal(maximum).add(BigDecimal.ONE);
        boolean blocked = attempted.compareTo(new BigDecimal(maximum)) > 0;
        return item("AMOUNT_MANIPULATION", blocked ? "BLOCKED" : "VULNERABLE", "Amount manipulation",
                blocked ? "A synthetic amount above the passport maximum is rejected by the stored maxAmount policy." : "The synthetic amount was not rejected.",
                "Amount <= " + maximum, "Synthetic amount " + attempted.toPlainString());
    }

    private SimulationScenarioResult targetScenario(PaymentPassport p) {
        String allowed = constraints(p.getConstraintsPayload()).get("allowedTarget");
        if (allowed == null || allowed.isBlank() || "*".equals(allowed))
            return item("UNAUTHORIZED_TARGET", "VULNERABLE", "Unauthorized target",
                    "No restrictive allowedTarget value is stored; the policy cannot reject an arbitrary target based on this field.",
                    "Specific allowed target", String.valueOf(allowed));
        String synthetic = "0x000000000000000000000000000000000000dEaD";
        boolean blocked = !allowed.equalsIgnoreCase(synthetic);
        return item("UNAUTHORIZED_TARGET", blocked ? "BLOCKED" : "VULNERABLE", "Unauthorized target",
                blocked ? "A target different from the configured allowedTarget is rejected by the modeled target policy." : "The synthetic target matches the allowed target.",
                allowed, synthetic);
    }

    private SimulationScenarioResult selectorScenario(PaymentPassport p) {
        String allowed = constraints(p.getConstraintsPayload()).get("allowedSelector");
        if (allowed == null || allowed.isBlank() || "*".equals(allowed))
            return item("SELECTOR_MANIPULATION", "VULNERABLE", "Function selector manipulation",
                    "No restrictive allowedSelector is stored.", "Specific allowed selector", String.valueOf(allowed));
        String synthetic = "0xffffffff";
        boolean blocked = !allowed.equalsIgnoreCase(synthetic);
        return item("SELECTOR_MANIPULATION", blocked ? "BLOCKED" : "VULNERABLE", "Function selector manipulation",
                blocked ? "A selector different from the configured allowedSelector is rejected by the modeled selector policy." : "The synthetic selector matches the allowed selector.",
                allowed, synthetic);
    }

    private SimulationScenarioResult nonceScenario(PaymentPassport p) {
        try {
            // Reuse the project's Safe-aware nonce validation instead of comparing
            // the Safe contract's nonce with the EOA transaction count.
            safeTransactionService.calculateSafeTransactionHash(p);
            return inconclusive("NONCE_REPLAY", "Nonce replay",
                    "The passport nonce currently matches the configured Safe nonce. This read-only check cannot prove replay resistance after signing or execution.");
        } catch (SecurityException ex) {
            String message = safe(ex);
            if (message.toLowerCase(Locale.ROOT).contains("nonce changed")) {
                return item("NONCE_REPLAY", "BLOCKED", "Nonce replay",
                        "The passport nonce differs from the current on-chain Safe nonce, so the stored proposal is stale.",
                        "Passport nonce equals current Safe nonce", message);
            }
            return inconclusive("NONCE_REPLAY", "Nonce replay", message);
        } catch (Exception ex) {
            return inconclusive("NONCE_REPLAY", "Nonce replay", "Safe nonce could not be validated: " + safe(ex));
        }
    }

    private SimulationScenarioResult baselineCall(PaymentPassport p) {
        try {
            web3j.ethChainId().send();
            var tx = org.web3j.protocol.core.methods.request.Transaction.createFunctionCallTransaction(
                    p.getAccount(), BigInteger.valueOf(p.getTransactionNonce()), BigInteger.ZERO,
                    BigInteger.valueOf(30_000_000L), p.getTransactionTarget(),
                    new BigInteger(p.getTransactionValueWei()), p.getTransactionData());
            var call = web3j.ethCall(tx, DefaultBlockParameterName.LATEST).send();
            if (call.hasError()) return item("BASELINE_EVM_CALL", "BLOCKED", "Baseline EVM call",
                    "The saved target call reverts in eth_call.", "Successful EVM call", call.getError().getMessage());
            var estimate = web3j.ethEstimateGas(tx).send();
            if (estimate.hasError()) return item("BASELINE_EVM_CALL", "BLOCKED", "Baseline EVM call",
                    "The saved target call could not be gas-estimated.", "Successful gas estimation", estimate.getError().getMessage());
            return item("BASELINE_EVM_CALL", "PASS", "Baseline EVM call",
                    "The saved target call passes eth_call and gas estimation. This only tests the target call, not Safe owner signatures or Guard enforcement.",
                    "Call rejected for a simulated malicious proposal", "Call succeeded; estimated gas=" + estimate.getAmountUsed());
        } catch (Exception ex) {
            return inconclusive("BASELINE_EVM_CALL", "Baseline EVM call", "RPC simulation could not complete: " + safe(ex));
        }
    }

    private Map<String, String> constraints(String payload) {
        // PassportService stores fields in a length-prefixed canonical sequence.
        String[] names = {"maxAmount", "allowedTarget", "allowedSelector", "expectedCodeHash",
                "allowDelegateCall", "allowUnlimitedApproval", "dailyLimit", "cooldownSeconds"};
        java.util.HashMap<String, String> values = new java.util.HashMap<>();
        if (payload == null) return values;
        int cursor = 0;
        try {
            for (String name : names) {
                int colon = payload.indexOf(':', cursor);
                if (colon < 0) break;
                int length = Integer.parseInt(payload.substring(cursor, colon));
                int start = colon + 1;
                int end = start + length;
                if (length < 0 || end > payload.length()) break;
                values.put(name, payload.substring(start, end));
                cursor = end;
            }
        } catch (RuntimeException ignored) { /* malformed stored constraints remain inconclusive */ }
        return values;
    }

    private boolean decimal(String value) {
        try { new BigDecimal(value); return true; } catch (Exception ex) { return false; }
    }
    private SimulationScenarioResult inconclusive(String id, String title, String summary) {
        return item(id, "INCONCLUSIVE", title, summary, "A supported deterministic check", "Not established");
    }
    private SimulationScenarioResult item(String id, String status, String title, String summary, String expected, String actual) {
        return new SimulationScenarioResult(id, status, title, summary, expected, actual);
    }
    private String safe(Exception ex) { return ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage(); }
}
