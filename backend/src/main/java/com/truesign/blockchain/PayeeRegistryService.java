package com.truesign.blockchain;

import com.truesign.dto.request.RegisterPayeeRequest;
import com.truesign.entity.PayeeRecord;
import com.truesign.repository.PayeeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.Transaction;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PayeeRegistryService {

    private final Web3j web3j;
    private final PayeeRepository repository;

    @Value("${truesign.contracts.payee-registry-address}")
    private String registryAddress;

    @Value("${truesign.blockchain.chain-id}")
    private long expectedChainId;

    public PayeeRegistryService(Web3j web3j, PayeeRepository repository) {
        this.web3j = web3j;
        this.repository = repository;
    }

    public Map<String, Object> confirmRegistration(RegisterPayeeRequest request)
            throws Exception {

        String account = normalize(request.account());
        String payee = normalize(request.payee());
        String txHash = request.transactionHash();

        if (account.equals(payee)) {
            throw new IllegalArgumentException("An account cannot register itself as a payee.");
        }

        long chainId = web3j.ethChainId().send().getChainId().longValueExact();

        if (chainId != expectedChainId) {
            throw new IllegalStateException(
                    "Wrong blockchain network. Expected chain " + expectedChainId +
                    " but connected to " + chainId
            );
        }

        var receiptResponse = web3j.ethGetTransactionReceipt(txHash).send();

        var receipt = receiptResponse.getTransactionReceipt()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Transaction is not mined or does not exist."
                ));

        if (!"0x1".equalsIgnoreCase(receipt.getStatus())) {
            throw new IllegalArgumentException("Payee registration transaction failed.");
        }

        Transaction transaction = web3j.ethGetTransactionByHash(txHash)
                .send()
                .getTransaction()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Transaction details could not be retrieved."
                ));

        if (!account.equalsIgnoreCase(transaction.getFrom())) {
            throw new IllegalArgumentException(
                    "Transaction sender does not match the requested account."
            );
        }

        if (transaction.getTo() == null ||
                !registryAddress.equalsIgnoreCase(transaction.getTo())) {
            throw new IllegalArgumentException(
                    "Transaction was not sent to the configured PayeeRegistry."
            );
        }

        Function registerFunction = new Function(
                "registerPayee",
                List.of(new Address(payee)),
                List.of()
        );

        String expectedInput = FunctionEncoder.encode(registerFunction);

        if (!expectedInput.equalsIgnoreCase(transaction.getInput())) {
            throw new IllegalArgumentException(
                    "Transaction calldata does not match registerPayee(payee)."
            );
        }

        BigInteger activationTimestamp = readUint256(
                "activationTimestamp",
                List.of(new Address(account), new Address(payee))
        );

        if (activationTimestamp.signum() <= 0) {
            throw new IllegalStateException(
                    "Registration transaction succeeded but the contract has no activation timestamp."
            );
        }

        PayeeRecord record = repository
                .findByAccountAndPayee(account, payee)
                .orElseGet(PayeeRecord::new);

        record.setAccount(account);
        record.setPayee(payee);
        record.setTransactionHash(txHash);
        record.setActivationTimestamp(activationTimestamp.toString());
        record.setCreatedAt(Instant.now());

        repository.save(record);

        return getPayeeStatus(account, payee);
    }

    public Map<String, Object> getPayeeStatus(String account, String payee)
            throws Exception {

        account = normalize(account);
        payee = normalize(payee);

        boolean registered = readBool(
                "isPayeeRegistered",
                List.of(new Address(account), new Address(payee))
        );

        boolean active = readBool(
                "isPayeeActive",
                List.of(new Address(account), new Address(payee))
        );

        BigInteger activationTimestamp = readUint256(
                "activationTimestamp",
                List.of(new Address(account), new Address(payee))
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account", account);
        result.put("payee", payee);
        result.put("registered", registered);
        result.put("active", active);
        result.put("activationTimestamp", activationTimestamp.toString());
        result.put("activationTime", activationTimestamp.signum() > 0
                ? Instant.ofEpochSecond(activationTimestamp.longValue()).toString()
                : null);
        result.put("registryAddress", registryAddress);
        result.put("chainId", expectedChainId);

        repository.findByAccountAndPayee(account, payee).ifPresent(record -> {
            result.put("registrationTransactionHash", record.getTransactionHash());
            result.put("backendRecordedAt", record.getCreatedAt());
        });

        return result;
    }

    private boolean readBool(String functionName, List<org.web3j.abi.datatypes.Type> inputs)
            throws Exception {
        String output = callView(functionName, inputs);
        return new BigInteger(output, 16).signum() != 0;
    }

    private BigInteger readUint256(
            String functionName,
            List<org.web3j.abi.datatypes.Type> inputs
    ) throws Exception {
        String output = callView(functionName, inputs);
        return new BigInteger(output, 16);
    }

    private String callView(
            String functionName,
            List<org.web3j.abi.datatypes.Type> inputs
    ) throws Exception {

        Function function = new Function(functionName, inputs, List.of());
        String data = FunctionEncoder.encode(function);

        var response = web3j.ethCall(
                org.web3j.protocol.core.methods.request.Transaction.createEthCallTransaction(
                        null, registryAddress, data
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "PayeeRegistry call failed: " + response.getError().getMessage()
            );
        }

        String value = Numeric.cleanHexPrefix(response.getValue());

        if (value == null || value.isBlank()) {
            throw new IllegalStateException("PayeeRegistry returned empty data.");
        }

        return value;
    }

    private String normalize(String address) {
        if (address == null ||
                !address.matches("(?i)^0x[a-f0-9]{40}$")) {
            throw new IllegalArgumentException("Invalid Ethereum address.");
        }
        return address.toLowerCase();
    }
}