
package com.truesign.service;

import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterNumber;
import org.web3j.protocol.core.methods.response.EthBlock;
import org.web3j.protocol.core.methods.response.TransactionReceipt;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Optional;

@Service
public class ExecutionReceiptService {

    private final Web3j web3j;

    public ExecutionReceiptService(Web3j web3j) {
        this.web3j = web3j;
    }

    /**
     * Retrieves the execution receipt for a blockchain transaction.
     */
    public Optional<ExecutionReceipt> getExecutionReceipt(
            String transactionHash) {

        if (transactionHash == null ||
                !transactionHash.matches("0x[0-9a-fA-F]{64}")) {
            throw new IllegalArgumentException(
                    "Invalid Ethereum transaction hash");
        }

        try {
            var response = web3j
                    .ethGetTransactionReceipt(transactionHash)
                    .send();

            Optional<TransactionReceipt> optionalReceipt =
                    response.getTransactionReceipt();

            if (optionalReceipt.isEmpty()) {
                return Optional.empty();
            }

            TransactionReceipt receipt = optionalReceipt.get();

            BigInteger blockNumber = receipt.getBlockNumber();
            BigInteger gasUsed = receipt.getGasUsed();

            Instant executedAt = null;

            if (blockNumber != null) {
                EthBlock blockResponse = web3j
                        .ethGetBlockByNumber(
                                new DefaultBlockParameterNumber(blockNumber),
                                false)
                        .send();

                EthBlock.Block block = blockResponse.getBlock();

                if (block != null && block.getTimestamp() != null) {
                    executedAt = Instant.ofEpochSecond(
                            block.getTimestamp().longValueExact());
                }
            }

            boolean successful =
                    "0x1".equalsIgnoreCase(receipt.getStatus()) ||
                            "0x01".equalsIgnoreCase(receipt.getStatus());

            return Optional.of(new ExecutionReceipt(
                    receipt.getTransactionHash(),
                    blockNumber,
                    successful,
                    receipt.getStatus(),
                    gasUsed,
                    executedAt
            ));

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Failed to retrieve blockchain execution receipt: "
                            + exception.getMessage(),
                    exception
            );
        }
    }

    /**
     * Structured execution receipt returned by this service.
     */
    public record ExecutionReceipt(
            String transactionHash,
            BigInteger blockNumber,
            boolean successful,
            String status,
            BigInteger gasUsed,
            Instant executedAt
    ) {}
}
