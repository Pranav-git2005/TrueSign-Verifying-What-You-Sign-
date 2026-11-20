package com.truesign.verifier;

import com.truesign.dto.response.AnomalyDto;
import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;
import org.springframework.stereotype.Component;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;

import java.math.BigInteger;
import java.time.Instant;
import java.util.List;

@Component
public class SimulationVerifier implements Verifier {

    private final Web3j web3j;

    public SimulationVerifier(Web3j web3j) {
        this.web3j = web3j;
    }

    @Override
    public String getVerifierName() {
        return "SIMULATION_VERIFIER";
    }

    @Override
    public VerifierVerdictDto verify(PaymentPassport passport) {

        try {
            BigInteger value = new BigInteger(
                    passport.getTransactionValueWei()
            );

            if (value.signum() < 0) {
                return result("RED", false, new AnomalyDto(
                        "INVALID_TRANSACTION_VALUE",
                        "CRITICAL",
                        "Transaction value cannot be negative.",
                        "Zero or positive value",
                        value.toString()
                ));
            }

            // Confirm RPC availability before interpreting simulation results.
            web3j.ethChainId().send();

            Transaction transaction =
                    Transaction.createFunctionCallTransaction(
                            passport.getAccount(),
                            BigInteger.valueOf(passport.getTransactionNonce()),
                            BigInteger.ZERO,
                            BigInteger.valueOf(30_000_000L),
                            passport.getTransactionTarget(),
                            value,
                            passport.getTransactionData()
                    );

            var call = web3j.ethCall(
                    transaction,
                    DefaultBlockParameterName.LATEST
            ).send();

            if (call.hasError()) {
                return result("RED", false, new AnomalyDto(
                        "SIMULATION_REVERT",
                        "CRITICAL",
                        "EVM transaction simulation reverted.",
                        "Successful execution",
                        call.getError().getMessage()
                ));
            }

            var estimate = web3j.ethEstimateGas(transaction).send();

            if (estimate.hasError()) {
                return result("AMBER", false, new AnomalyDto(
                        "GAS_ESTIMATION_FAILED",
                        "HIGH",
                        "Gas estimation failed.",
                        "Successful gas estimation",
                        estimate.getError().getMessage()
                ));
            }

            if (estimate.getAmountUsed() == null
                    || estimate.getAmountUsed().signum() <= 0) {
                return result("AMBER", false, new AnomalyDto(
                        "INVALID_GAS_ESTIMATE",
                        "HIGH",
                        "Blockchain returned an invalid gas estimate.",
                        "Positive gas estimate",
                        String.valueOf(estimate.getAmountUsed())
                ));
            }

            return new VerifierVerdictDto(
                    getVerifierName(),
                    true,
                    "GREEN",
                    "Target call passed eth_call and gas estimation. This is not a full Safe, owner-signature, Guard, or module-path simulation.",
                    List.of(),
                    Instant.now()
            );

        } catch (Exception exception) {

            String message = exception.getMessage() == null
                    ? "Unknown RPC error"
                    : exception.getMessage();

            String lower = message.toLowerCase();

            boolean unavailable =
                    lower.contains("connect")
                    || lower.contains("refused")
                    || lower.contains("timeout")
                    || lower.contains("connection");

            if (unavailable) {
                return result("INCONCLUSIVE", false, new AnomalyDto(
                        "SIMULATION_UNAVAILABLE",
                        "WARNING",
                        "Blockchain RPC is unavailable. Safety could not be established.",
                        "Connected blockchain RPC",
                        message
                ));
            }

            return result("RED", false, new AnomalyDto(
                    "SIMULATION_ERROR",
                    "CRITICAL",
                    "Unexpected simulation error occurred.",
                    "Successful simulation",
                    message
            ));
        }
    }

    private VerifierVerdictDto result(
            String status,
            boolean passed,
            AnomalyDto anomaly) {

        return new VerifierVerdictDto(
                getVerifierName(),
                passed,
                status,
                "Simulation result: " + status,
                List.of(anomaly),
                Instant.now()
        );
    }
}