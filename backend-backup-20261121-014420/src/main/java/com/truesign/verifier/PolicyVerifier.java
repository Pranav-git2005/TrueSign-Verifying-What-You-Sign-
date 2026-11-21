package com.truesign.verifier;

import com.truesign.dto.response.AnomalyDto;
import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;

import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.response.EthGetCode;
import org.web3j.utils.Numeric;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class PolicyVerifier implements Verifier {

    private static final String APPROVE_SELECTOR = "095ea7b3";
    private static final String SET_APPROVAL_FOR_ALL_SELECTOR = "a22cb465";
    private static final BigInteger UINT128_LIMIT = BigInteger.ONE.shiftLeft(128);

    private final Web3j web3j;

    public PolicyVerifier(Web3j web3j) {
        this.web3j = web3j;
    }

    @Override
    public String getVerifierName() {
        return "POLICY_VERIFIER";
    }

    @Override
    public VerifierVerdictDto verify(PaymentPassport passport) {

        List<AnomalyDto> anomalies = new ArrayList<>();

        try {
            List<String> constraints = decodeConstraints(
                    passport.getConstraintsPayload()
            );

            String maxAmount = constraints.get(0);
            String allowedTarget = constraints.get(1);
            String allowedSelector = constraints.get(2);
            String expectedCodeHash = constraints.get(3);
            boolean allowDelegateCall = Boolean.parseBoolean(constraints.get(4));
            boolean allowUnlimitedApproval = Boolean.parseBoolean(constraints.get(5));
            String dailyLimit = constraints.get(6);

            String target = normalize(passport.getTransactionTarget());
            String calldata = passport.getTransactionData();

            String data = calldata == null
                    ? ""
                    : calldata.replaceFirst("(?i)^0x", "").toLowerCase();

            String selector = data.length() >= 8
                    ? data.substring(0, 8)
                    : "";

            // 1. Delegatecall policy
            if (passport.getOperation() == 1 && !allowDelegateCall) {
                add(anomalies, "DELEGATECALL_DETECTED", "CRITICAL",
                        "Delegatecall is not permitted by this Payment Passport.",
                        "Delegatecall disabled", "Delegatecall detected");
            }

            if (passport.getOperation() != 0 && passport.getOperation() != 1) {
                add(anomalies, "INVALID_OPERATION", "CRITICAL",
                        "Transaction contains an unsupported operation.",
                        "0 or 1", String.valueOf(passport.getOperation()));
            }

            // 2. Enforce allowed target
            if (!isBlank(allowedTarget) &&
                    !normalize(allowedTarget).equals(target)) {
                add(anomalies, "UNEXPECTED_TARGET", "CRITICAL",
                        "Transaction target is not the target approved in the Passport.",
                        allowedTarget, passport.getTransactionTarget());
            }

            // 3. Enforce allowed selector
            if (!isBlank(allowedSelector)) {
                String expectedSelector = allowedSelector
                        .replaceFirst("(?i)^0x", "")
                        .toLowerCase();

                if (!expectedSelector.equals(selector)) {
                    add(anomalies, "UNEXPECTED_SELECTOR", "CRITICAL",
                            "Transaction function is not permitted by the Passport.",
                            "0x" + expectedSelector,
                            selector.isBlank() ? "No selector" : "0x" + selector);
                }
            }

            // 4. Validate payment amount against both limits
            BigDecimal amount = new BigDecimal(passport.getAmount());

            if (amount.signum() <= 0) {
                add(anomalies, "INVALID_PAYMENT_AMOUNT", "CRITICAL",
                        "Payment amount must be greater than zero.",
                        "Amount > 0", amount.toPlainString());
            } else {
                BigDecimal maximum = new BigDecimal(maxAmount);
                BigDecimal daily = new BigDecimal(dailyLimit);

                if (amount.compareTo(maximum) > 0) {
                    add(anomalies, "MAX_AMOUNT_EXCEEDED", "CRITICAL",
                            "Payment exceeds the maximum amount allowed by the Passport.",
                            maximum.toPlainString(), amount.toPlainString());
                }

                if (amount.compareTo(daily) > 0) {
                    add(anomalies, "DAILY_LIMIT_EXCEEDED", "CRITICAL",
                            "Payment amount exceeds the configured daily-limit ceiling.",
                            daily.toPlainString(), amount.toPlainString());
                }
            }

            // 5. Detect ERC-20 approve(address,uint256)
            if (APPROVE_SELECTOR.equals(selector)) {
                if (data.length() != 136) {
                    add(anomalies, "MALFORMED_APPROVAL", "CRITICAL",
                            "ERC-20 approval calldata has an invalid length.",
                            "136 hexadecimal characters", String.valueOf(data.length()));
                } else {
                    String spenderWord = data.substring(8, 72);
                    String amountWord = data.substring(72, 136);

                    if (!spenderWord.substring(0, 24).equals("000000000000000000000000")) {
                        add(anomalies, "INVALID_APPROVAL_SPENDER", "CRITICAL",
                                "Approval spender has invalid ABI address encoding.",
                                "12 leading zero bytes", spenderWord.substring(0, 24));
                    }

                    try {
                        BigInteger approvalAmount = new BigInteger(amountWord, 16);

                        boolean unlimited = approvalAmount.compareTo(UINT128_LIMIT) >= 0;

                        if (unlimited && !allowUnlimitedApproval) {
                            add(anomalies, "UNLIMITED_APPROVAL", "CRITICAL",
                                    "Large or unlimited token approval is blocked by policy.",
                                    "Approval below 2^128 or explicitly allowed",
                                    approvalAmount.toString());
                        }
                    } catch (NumberFormatException exception) {
                        add(anomalies, "INVALID_APPROVAL_AMOUNT", "CRITICAL",
                                "Approval amount is not valid hexadecimal data.",
                                "Valid uint256", amountWord);
                    }
                }
            }

            // 6. Detect setApprovalForAll(address,bool)
            if (SET_APPROVAL_FOR_ALL_SELECTOR.equals(selector)) {
                if (data.length() != 136) {
                    add(anomalies, "MALFORMED_OPERATOR_APPROVAL", "CRITICAL",
                            "setApprovalForAll calldata has an invalid length.",
                            "136 hexadecimal characters", String.valueOf(data.length()));
                } else {
                    String operatorWord = data.substring(8, 72);
                    String approvedWord = data.substring(72, 136);

                    if (!operatorWord.substring(0, 24).equals("000000000000000000000000")) {
                        add(anomalies, "INVALID_OPERATOR_ADDRESS", "CRITICAL",
                                "Operator address has invalid ABI encoding.",
                                "12 leading zero bytes", operatorWord.substring(0, 24));
                    }

                    if (approvedWord.equals("0000000000000000000000000000000000000000000000000000000000000001")) {
                        add(anomalies, "SET_APPROVAL_FOR_ALL", "CRITICAL",
                                "Operator-wide token approval detected.",
                                "approved = false", "approved = true");
                    } else if (!approvedWord.equals("0000000000000000000000000000000000000000000000000000000000000000")) {
                        add(anomalies, "INVALID_OPERATOR_APPROVAL_FLAG", "CRITICAL",
                                "Approval flag is not a valid ABI boolean.",
                                "0 or 1", approvedWord);
                    }
                }
            }

            // 7. Verify target contract code hash if configured
            if (!isBlank(expectedCodeHash)) {
                String expected = expectedCodeHash
                        .replaceFirst("(?i)^0x", "")
                        .toLowerCase();

                EthGetCode codeResponse = web3j.ethGetCode(
                        passport.getTransactionTarget(),
                        org.web3j.protocol.core.DefaultBlockParameterName.LATEST
                ).send();

                if (codeResponse.hasError()) {
                    add(anomalies, "CODE_HASH_CHECK_UNAVAILABLE", "WARNING",
                            "Could not retrieve target contract bytecode.",
                            expected, codeResponse.getError().getMessage());
                } else {
                    String code = codeResponse.getCode();

                    if (code == null || "0x".equalsIgnoreCase(code)) {
                        add(anomalies, "TARGET_HAS_NO_CODE", "CRITICAL",
                                "Transaction target has no deployed contract bytecode.",
                                "Deployed contract", "No code");
                    } else {
                        String actual = Numeric.toHexStringNoPrefix(
                                Hash.sha3(Numeric.hexStringToByteArray(code))
                        ).toLowerCase();

                        if (!expected.equals(actual)) {
                            add(anomalies, "CODE_HASH_MISMATCH", "CRITICAL",
                                    "Target contract bytecode does not match the expected code hash.",
                                    "0x" + expected, "0x" + actual);
                        }
                    }
                }
            }

        } catch (Exception exception) {
            add(anomalies, "POLICY_CHECK_ERROR", "CRITICAL",
                    "Policy verification could not safely complete.",
                    "Valid Payment Passport constraints",
                    exception.getMessage() == null
                            ? exception.getClass().getSimpleName()
                            : exception.getMessage());
        }

        return createVerdict(anomalies);
    }

    private List<String> decodeConstraints(String payload) {

        if (payload == null || payload.isBlank()) {
            throw new IllegalArgumentException("Constraints payload is missing.");
        }

        List<String> values = new ArrayList<>();
        int position = 0;

        while (position < payload.length()) {
            int separator = payload.indexOf(':', position);

            if (separator < 0) {
                throw new IllegalArgumentException("Invalid constraints payload length prefix.");
            }

            int length = Integer.parseInt(payload.substring(position, separator));

            if (length < 0) {
                throw new IllegalArgumentException("Negative constraints field length.");
            }

            int valueStart = separator + 1;
            int valueEnd = valueStart + length;

            if (valueEnd > payload.length()) {
                throw new IllegalArgumentException("Constraints payload is truncated.");
            }

            values.add(payload.substring(valueStart, valueEnd));
            position = valueEnd;
        }

        if (values.size() != 8) {
            throw new IllegalArgumentException(
                    "Expected exactly 8 constraint fields but received " + values.size()
            );
        }

        if (!"true".equalsIgnoreCase(values.get(4)) &&
                !"false".equalsIgnoreCase(values.get(4))) {
            throw new IllegalArgumentException("Invalid allowDelegateCall value.");
        }

        if (!"true".equalsIgnoreCase(values.get(5)) &&
                !"false".equalsIgnoreCase(values.get(5))) {
            throw new IllegalArgumentException("Invalid allowUnlimitedApproval value.");
        }

        return values;
    }

    private void add(
            List<AnomalyDto> anomalies,
            String code,
            String severity,
            String message,
            String expected,
            String actual) {

        anomalies.add(new AnomalyDto(
                code, severity, message, expected, actual
        ));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private VerifierVerdictDto createVerdict(List<AnomalyDto> anomalies) {

        boolean passed = anomalies.isEmpty();

        return new VerifierVerdictDto(
                getVerifierName(),
                passed,
                passed ? "GREEN" : "RED",
                passed
                        ? "Transaction complies with the configured security policies."
                        : "One or more security policy violations were detected.",
                anomalies,
                Instant.now()
        );
    }
}