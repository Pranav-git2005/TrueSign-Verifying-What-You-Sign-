package com.truesign.blockchain;

import com.truesign.entity.PaymentPassport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.List;

@Service
public class SafeTransactionService {

    private final Web3j web3j;
    private final String safeAddress;

    public SafeTransactionService(
            Web3j web3j,
            @Value("${truesign.contracts.safe-address}") String safeAddress
    ) {
        this.web3j = web3j;
        this.safeAddress = safeAddress;
    }

    /**
     * Calculates the exact Safe transaction hash using the deployed Safe.
     *
     * Gas fields are deliberately fixed to zero. The same values must be
     * used when owners construct and sign the eventual Safe transaction.
     */
    public String calculateSafeTransactionHash(
            PaymentPassport passport
    ) throws Exception {

        if (passport == null) {
            throw new IllegalArgumentException("Passport is required.");
        }

        if (!passport.getAccount().equalsIgnoreCase(safeAddress)) {
            throw new SecurityException(
                    "Passport account does not match configured Safe."
            );
        }

        if (passport.getOperation() != 0) {
            throw new SecurityException(
                    "Only Safe CALL operations are supported."
            );
        }

        BigInteger actualChainId = web3j.ethChainId()
                .send()
                .getChainId();

        if (!actualChainId.equals(BigInteger.valueOf(passport.getChainId()))) {
            throw new SecurityException("Passport chain ID does not match RPC.");
        }

        BigInteger onChainNonce = readSafeNonce();

        BigInteger passportNonce =
                BigInteger.valueOf(passport.getTransactionNonce());

        if (!onChainNonce.equals(passportNonce)) {
            throw new SecurityException(
                    "Safe nonce changed. Expected "
                            + passportNonce + " but current nonce is "
                            + onChainNonce
            );
        }

        BigInteger value = new BigInteger(
                passport.getTransactionValueWei()
        );

        if (value.signum() < 0) {
            throw new IllegalArgumentException("Transaction value cannot be negative.");
        }

        String data = passport.getTransactionData();

        if (data == null || !data.matches("(?i)^0x([0-9a-f]{2})*$")) {
            throw new IllegalArgumentException("Invalid transaction calldata.");
        }

        Function function = new Function(
                "getTransactionHash",
                List.of(
                        new Address(passport.getTransactionTarget()),
                        new Uint256(value),
                        new DynamicBytes(Numeric.hexStringToByteArray(data)),
                        new Uint8(BigInteger.valueOf(passport.getOperation())),
                        new Uint256(BigInteger.ZERO),
                        new Uint256(BigInteger.ZERO),
                        new Uint256(BigInteger.ZERO),
                        new Address("0x0000000000000000000000000000000000000000"),
                        new Address("0x0000000000000000000000000000000000000000"),
                        new Uint256(onChainNonce)
                ),
                List.of(new TypeReference<Bytes32>() {})
        );

        String encoded = FunctionEncoder.encode(function);

        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        null,
                        safeAddress,
                        encoded
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "Safe transaction hash call failed: "
                            + response.getError().getMessage()
            );
        }

        List<Type> decoded = FunctionReturnDecoder.decode(
                response.getValue(),
                function.getOutputParameters()
        );

        if (decoded.isEmpty()) {
            throw new IllegalStateException(
                    "Safe returned an empty transaction hash."
            );
        }

        Bytes32 hash = (Bytes32) decoded.get(0);
        String result = Numeric.toHexString(hash.getValue());

        if (!result.matches("(?i)^0x[a-f0-9]{64}$")) {
            throw new IllegalStateException("Invalid Safe transaction hash.");
        }

        return result;
    }

    private BigInteger readSafeNonce() throws Exception {

        Function function = new Function(
                "nonce",
                List.of(),
                List.of(new TypeReference<Uint256>() {})
        );

        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        null,
                        safeAddress,
                        FunctionEncoder.encode(function)
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "Unable to read Safe nonce: "
                            + response.getError().getMessage()
            );
        }

        List<Type> decoded = FunctionReturnDecoder.decode(
                response.getValue(),
                function.getOutputParameters()
        );

        if (decoded.isEmpty()) {
            throw new IllegalStateException("Safe nonce response is empty.");
        }

        return (BigInteger) decoded.get(0).getValue();
    }
}