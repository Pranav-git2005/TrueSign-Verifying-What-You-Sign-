
package com.truesign.service;

import com.truesign.dto.request.CreatePassportRequest;
import com.truesign.dto.request.ConstraintsDto;
import com.truesign.dto.request.IntentDto;
import com.truesign.dto.request.TransactionProposalDto;
import com.truesign.dto.response.PassportResponse;
import com.truesign.entity.PaymentPassport;
import com.truesign.repository.PaymentPassportRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class PassportService {

    private final PaymentPassportRepository repository;

    public PassportService(PaymentPassportRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public PassportResponse createPassport(CreatePassportRequest request) {

        validateBusinessRules(request);

        IntentDto intent = request.intent();
        ConstraintsDto constraints = request.constraints();
        TransactionProposalDto transaction = request.transaction();

        Instant createdAt = Instant.now();

        String constraintsPayload = canonical(
                constraints.maxAmount(),
                constraints.allowedTarget(),
                constraints.allowedSelector(),
                constraints.expectedCodeHash(),
                Boolean.toString(constraints.allowDelegateCall()),
                Boolean.toString(constraints.allowUnlimitedApproval()),
                constraints.dailyLimit(),
                Long.toString(constraints.cooldownSeconds())
        );

        String intentHash = hash(
                intent.purpose(),
                intent.summary(),
                intent.recipient().toLowerCase(),
                intent.tokenAddress().toLowerCase(),
                intent.tokenSymbol(),
                intent.amount()
        );

        String transactionHash = hash(
                transaction.to().toLowerCase(),
                transaction.valueWei(),
                transaction.data().toLowerCase(),
                Integer.toString(transaction.operation()),
                Long.toString(transaction.nonce())
        );

        String constraintsHash = hash(constraintsPayload);

        String passportHash = hash(
                request.account().toLowerCase(),
                request.mode(),
                Long.toString(request.chainId()),
                intentHash,
                transactionHash,
                constraintsHash,
                request.expiresAt().toString()
        );

        PaymentPassport passport = new PaymentPassport();

        passport.setId(UUID.randomUUID().toString());
        passport.setAccount(request.account().toLowerCase());
        passport.setMode(request.mode());
        passport.setChainId(request.chainId());

        passport.setPurpose(intent.purpose());
        passport.setSummary(intent.summary());
        passport.setIntendedRecipient(intent.recipient().toLowerCase());
        passport.setTokenAddress(intent.tokenAddress().toLowerCase());
        passport.setTokenSymbol(intent.tokenSymbol());
        passport.setAmount(intent.amount());

        passport.setTransactionTarget(transaction.to().toLowerCase());
        passport.setTransactionValueWei(transaction.valueWei());
        passport.setTransactionData(transaction.data().toLowerCase());
        passport.setOperation(transaction.operation());
        passport.setTransactionNonce(transaction.nonce());

        passport.setIntentHash(intentHash);
        passport.setTransactionHash(transactionHash);
        passport.setConstraintsHash(constraintsHash);
        passport.setConstraintsPayload(constraintsPayload);
        passport.setPassportHash(passportHash);

        passport.setCreatedAt(createdAt);
        passport.setExpiresAt(request.expiresAt());
        passport.setStatus("CREATED");

        PaymentPassport saved = repository.save(passport);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PassportResponse getPassport(String passportId) {

        PaymentPassport passport = repository.findById(passportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment Passport not found: " + passportId
                ));

        return toResponse(passport);
    }

    private void validateBusinessRules(CreatePassportRequest request) {

        BigDecimal amount = new BigDecimal(request.intent().amount());
        BigDecimal maxAmount = new BigDecimal(
                request.constraints().maxAmount()
        );

        BigDecimal dailyLimit = new BigDecimal(
                request.constraints().dailyLimit()
        );

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Payment amount must be greater than zero"
            );
        }

        if (maxAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Maximum amount must be greater than zero"
            );
        }

        if (dailyLimit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Daily limit must be greater than zero"
            );
        }

        if (amount.compareTo(maxAmount) > 0) {
            throw new IllegalArgumentException(
                    "Payment amount exceeds the configured maximum"
            );
        }

        if (request.transaction().operation() != 0 &&
                request.transaction().operation() != 1) {
            throw new IllegalArgumentException(
                    "Transaction operation must be 0 (CALL) or 1 (DELEGATECALL)"
            );
        }

        if (request.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException(
                    "Payment Passport expiry must be in the future"
            );
        }
    }

    private PassportResponse toResponse(PaymentPassport passport) {

        return new PassportResponse(
                passport.getId(),
                passport.getAccount(),
                passport.getMode(),
                passport.getChainId(),
                passport.getPurpose(),
                passport.getIntendedRecipient(),
                passport.getTokenSymbol(),
                passport.getAmount(),
                passport.getIntentHash(),
                passport.getTransactionHash(),
                passport.getPassportHash(),
                passport.getCreatedAt(),
                passport.getExpiresAt(),
                passport.getStatus()
        );
    }

    private String hash(String... values) {
        return hash(canonical(values));
    }

    private String canonical(String... values) {

        StringBuilder builder = new StringBuilder();

        for (String value : values) {
            String safeValue = value == null ? "" : value;
            byte[] bytes = safeValue.getBytes(StandardCharsets.UTF_8);

            builder.append(bytes.length)
                    .append(':')
                    .append(safeValue);
        }

        return builder.toString();
    }

    private String hash(String value) {

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    value.getBytes(StandardCharsets.UTF_8)
            );

            return "0x" + HexFormat.of().formatHex(hash);

        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 algorithm is unavailable",
                    exception
            );
        }
    }
}
