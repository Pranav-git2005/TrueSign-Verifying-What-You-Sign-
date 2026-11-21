package com.truesign.service;

import com.truesign.blockchain.PayeeRegistryService;
import com.truesign.dto.response.SnapshotDto;
import com.truesign.entity.PaymentPassport;
import com.truesign.entity.PassportSnapshot;
import com.truesign.repository.PaymentPassportRepository;
import com.truesign.repository.PassportSnapshotRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SnapshotService {

    private final Web3j web3j;
    private final PaymentPassportRepository passportRepository;
    private final PassportSnapshotRepository snapshotRepository;
    private final PayeeRegistryService payeeRegistryService;

    @Value("${truesign.payee.cooldown-seconds:86400}")
    private long cooldownSeconds;

    public SnapshotService(
            Web3j web3j,
            PaymentPassportRepository passportRepository,
            PassportSnapshotRepository snapshotRepository,
            PayeeRegistryService payeeRegistryService
    ) {
        this.web3j = web3j;
        this.passportRepository = passportRepository;
        this.snapshotRepository = snapshotRepository;
        this.payeeRegistryService = payeeRegistryService;
    }

    @Transactional
    public SnapshotDto capture(String passportId, String snapshotType)
            throws Exception {

        PaymentPassport passport = passportRepository.findById(passportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Payment Passport not found: " + passportId
                ));

        String account = passport.getAccount();
        String recipient = passport.getIntendedRecipient();
        String token = passport.getTokenAddress();
        String target = passport.getTransactionTarget();

        BigInteger blockNumber = web3j.ethBlockNumber()
                .send()
                .getBlockNumber();

        BigInteger accountNative = web3j.ethGetBalance(
                account, DefaultBlockParameterName.LATEST
        ).send().getBalance();

        BigInteger recipientNative = web3j.ethGetBalance(
                recipient, DefaultBlockParameterName.LATEST
        ).send().getBalance();

        BigInteger accountToken = readTokenBalance(token, account);
        BigInteger recipientToken = readTokenBalance(token, recipient);

        String code = web3j.ethGetCode(
                target, DefaultBlockParameterName.LATEST
        ).send().getCode();

        String codeHash = Hash.sha3(code == null ? "0x" : code);

        Map<String, Object> payeeStatus =
                payeeRegistryService.getPayeeStatus(account, recipient);

        boolean registered = Boolean.TRUE.equals(payeeStatus.get("registered"));
        boolean ready = Boolean.TRUE.equals(payeeStatus.get("active"));

        Object activationValue = payeeStatus.get("activationTimestamp");
        long activationTimestamp = activationValue == null
                ? 0L
                : Long.parseLong(activationValue.toString());

        long readyAt = activationTimestamp == 0
                ? 0L
                : activationTimestamp + cooldownSeconds;

        long now = Instant.now().getEpochSecond();

        long remaining = readyAt == 0
                ? 0L
                : Math.max(0L, readyAt - now);

        PassportSnapshot snapshot = new PassportSnapshot();

        snapshot.setId(UUID.randomUUID().toString());
        snapshot.setPassportId(passportId);
        snapshot.setSnapshotType(snapshotType);
        snapshot.setCapturedAtEpochMs(System.currentTimeMillis());
        snapshot.setBlockNumber(blockNumber.toString());

        snapshot.setAccountAddress(account);
        snapshot.setIntendedRecipient(recipient);
        snapshot.setTokenAddress(token);
        snapshot.setTargetContractAddress(target);

        snapshot.setAccountNativeBalanceWei(accountNative.toString());
        snapshot.setRecipientNativeBalanceWei(recipientNative.toString());
        snapshot.setAccountTokenBalance(accountToken.toString());
        snapshot.setRecipientTokenBalance(recipientToken.toString());

        snapshot.setTargetCodeHash(codeHash);

        snapshot.setPayeeRegistered(registered);
        snapshot.setPayeeReady(ready);
        snapshot.setReadyAtEpochSeconds(readyAt);
        snapshot.setRemainingCooldownSeconds(remaining);

        return toDto(snapshotRepository.save(snapshot));
    }

    @Transactional(readOnly = true)
    public List<SnapshotDto> getHistory(String passportId) {

        if (!passportRepository.existsById(passportId)) {
            throw new IllegalArgumentException(
                    "Payment Passport not found: " + passportId
            );
        }

        return snapshotRepository
                .findByPassportIdOrderByCapturedAtEpochMsAsc(passportId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private BigInteger readTokenBalance(String token, String holder)
            throws Exception {

        Function function = new Function(
                "balanceOf",
                List.of(new Address(holder)),
                List.of(new TypeReference<Uint256>() {})
        );

        String data = FunctionEncoder.encode(function);

        var response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, token, data),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "ERC-20 balanceOf failed: " +
                    response.getError().getMessage()
            );
        }

        String output = Numeric.cleanHexPrefix(response.getValue());

        if (output == null || output.isBlank()) {
            throw new IllegalStateException(
                    "ERC-20 balanceOf returned empty data for " + token
            );
        }

        return new BigInteger(output, 16);
    }

    private SnapshotDto toDto(PassportSnapshot s) {

        return new SnapshotDto(
                s.getId(),
                s.getPassportId(),
                s.getSnapshotType(),
                s.getCapturedAtEpochMs(),
                s.getBlockNumber(),
                s.getAccountAddress(),
                s.getIntendedRecipient(),
                s.getTokenAddress(),
                s.getTargetContractAddress(),
                s.getAccountNativeBalanceWei(),
                s.getRecipientNativeBalanceWei(),
                s.getAccountTokenBalance(),
                s.getRecipientTokenBalance(),
                s.getTargetCodeHash(),
                s.isPayeeRegistered(),
                s.isPayeeReady(),
                s.getReadyAtEpochSeconds(),
                s.getRemainingCooldownSeconds()
        );
    }
}