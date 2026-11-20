package com.truesign.verifier;

import com.truesign.dto.response.AnomalyDto;
import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.utils.Numeric;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class IntentVerifier implements Verifier {

    private static final String TRANSFER_SELECTOR = "a9059cbb";
    private final Web3j web3j;

    public IntentVerifier(Web3j web3j) {
        this.web3j = web3j;
    }

    @Override
    public String getVerifierName() {
        return "INTENT_VERIFIER";
    }

    @Override
    public VerifierVerdictDto verify(PaymentPassport passport) {

        List<AnomalyDto> anomalies = new ArrayList<>();

        String expectedRecipient = normalize(passport.getIntendedRecipient());
        String expectedToken = normalize(passport.getTokenAddress());
        String actualTarget = normalize(passport.getTransactionTarget());

        if (!expectedToken.equals(actualTarget)) {
            add(anomalies, "TARGET_MISMATCH", "CRITICAL",
                    "Transaction target does not match the intended token.",
                    expectedToken, actualTarget);
        }

        if (passport.getOperation() != 0) {
            add(anomalies, "UNEXPECTED_OPERATION", "CRITICAL",
                    "Only standard CALL operations are allowed.",
                    "0", String.valueOf(passport.getOperation()));
        }

        String calldata = passport.getTransactionData();

        if (calldata == null ||
                !calldata.matches("(?i)^0x([0-9a-f]{2})*$")) {
            add(anomalies, "INVALID_CALLDATA", "CRITICAL",
                    "Transaction calldata is missing or invalid.",
                    "Hexadecimal calldata", String.valueOf(calldata));
            return verdict(anomalies);
        }

        String data = calldata.substring(2).toLowerCase();

        if (data.length() != 136 || !data.startsWith(TRANSFER_SELECTOR)) {
            add(anomalies, "INVALID_TRANSFER_CALLDATA", "CRITICAL",
                    "Transaction is not a standard ERC-20 transfer.",
                    "transfer(address,uint256)",
                    data.length() >= 8 ? "0x" + data.substring(0,8) : "0x" + data);
            return verdict(anomalies);
        }

        String recipientWord = data.substring(8,72);

        if (!recipientWord.substring(0,24).equals("000000000000000000000000")) {
            add(anomalies, "INVALID_RECIPIENT_ENCODING", "CRITICAL",
                    "Recipient address has invalid ABI encoding.",
                    "12 leading zero bytes", recipientWord.substring(0,24));
            return verdict(anomalies);
        }

        String actualRecipient = "0x" + recipientWord.substring(24);

        if (!expectedRecipient.equals(actualRecipient)) {
            add(anomalies, "RECIPIENT_MISMATCH", "CRITICAL",
                    "Actual transaction recipient differs from the Payment Passport.",
                    expectedRecipient, actualRecipient);
        }

        String amountWord = data.substring(72,136);
        BigInteger actualRawAmount = new BigInteger(amountWord,16);

        try {
            BigDecimal expectedAmount = new BigDecimal(passport.getAmount());

            if (expectedAmount.signum() <= 0) {
                add(anomalies, "INVALID_INTENDED_AMOUNT", "CRITICAL",
                        "Payment amount must be positive.",
                        "Amount > 0", expectedAmount.toPlainString());
                return verdict(anomalies);
            }

            int decimals = readTokenDecimals(passport.getTokenAddress());
            BigInteger expectedRawAmount = toRawAmount(expectedAmount, decimals);

            if (!expectedRawAmount.equals(actualRawAmount)) {
                add(anomalies, "AMOUNT_MISMATCH", "CRITICAL",
                        "Calldata amount differs from the Payment Passport amount.",
                        expectedRawAmount.toString(), actualRawAmount.toString());
            }

        } catch (ArithmeticException exception) {
            add(anomalies, "INVALID_INTENDED_AMOUNT", "CRITICAL",
                    "Amount cannot be represented exactly using token decimals.",
                    "Exact token precision", passport.getAmount());
        } catch (NumberFormatException exception) {
            add(anomalies, "INVALID_INTENDED_AMOUNT", "CRITICAL",
                    "Payment Passport contains an invalid decimal amount.",
                    "Valid positive decimal amount", passport.getAmount());
        } catch (Exception exception) {
            return new VerifierVerdictDto(
                    getVerifierName(),
                    false,
                    "INCONCLUSIVE",
                    "Token decimals could not be verified; amount validation was not completed.",
                    List.of(new AnomalyDto(
                            "TOKEN_DECIMALS_UNAVAILABLE",
                            "WARNING",
                            "Unable to read decimals() from the intended token contract.",
                            "Readable ERC-20 decimals",
                            exception.getMessage() == null
                                    ? exception.getClass().getSimpleName()
                                    : exception.getMessage()
                    )),
                    Instant.now()
            );
        }

        return verdict(anomalies);
    }

    private int readTokenDecimals(String tokenAddress) throws Exception {

        if (tokenAddress == null ||
                !tokenAddress.matches("(?i)^0x[0-9a-f]{40}$")) {
            throw new IllegalArgumentException("Invalid token address.");
        }

        var response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        null,
                        tokenAddress,
                        "0x313ce567"
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "Token decimals call failed: " + response.getError().getMessage()
            );
        }

        String result = response.getValue();

        if (result == null || result.length() < 66) {
            throw new IllegalStateException("Token returned invalid decimals data.");
        }

        int decimals = new BigInteger(
                Numeric.cleanHexPrefix(result),16
        ).intValueExact();

        if (decimals < 0 || decimals > 255) {
            throw new IllegalStateException("Token decimals value is outside uint8.");
        }

        return decimals;
    }

    static BigInteger toRawAmount(BigDecimal amount, int decimals) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive.");
        }
        if (decimals < 0 || decimals > 255) {
            throw new IllegalArgumentException("Invalid token decimals.");
        }
        return amount.movePointRight(decimals).toBigIntegerExact();
    }

    private void add(
            List<AnomalyDto> anomalies,
            String code,
            String severity,
            String message,
            String expected,
            String actual
    ) {
        anomalies.add(new AnomalyDto(code,severity,message,expected,actual));
    }

    private VerifierVerdictDto verdict(List<AnomalyDto> anomalies) {
        boolean passed = anomalies.isEmpty();
        return new VerifierVerdictDto(
                getVerifierName(),
                passed,
                passed ? "GREEN" : "RED",
                passed
                        ? "Recipient and amount match the Payment Passport using on-chain token decimals."
                        : "Transaction does not match the Payment Passport.",
                anomalies,
                Instant.now()
        );
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}