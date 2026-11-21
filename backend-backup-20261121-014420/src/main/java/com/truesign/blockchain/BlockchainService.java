
package com.truesign.blockchain;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;

import java.math.BigInteger;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class BlockchainService {

    private final Web3j web3j;

    private static final BigInteger GUARD_STORAGE_SLOT =
            new BigInteger(
                    "4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8",
                    16
            );

    @Value("${truesign.blockchain.chain-id}")
    private long expectedChainId;

    @Value("${truesign.contracts.safe-address}")
    private String safeAddress;

    @Value("${truesign.contracts.guard-address}")
    private String guardAddress;

    @Value("${truesign.contracts.payee-registry-address}")
    private String registryAddress;

    @Value("${truesign.contracts.token-address}")
    private String tokenAddress;

    public BlockchainService(Web3j web3j) {
        this.web3j = web3j;
    }

    public Map<String, Object> getStatus() throws Exception {

        long actualChainId = web3j.ethChainId()
                .send()
                .getChainId()
                .longValueExact();

        String latestBlock = web3j.ethBlockNumber()
                .send()
                .getBlockNumber()
                .toString();

        boolean safeExists = contractExists(safeAddress);
        boolean guardExists = contractExists(guardAddress);
        boolean registryExists = contractExists(registryAddress);
        boolean tokenExists = contractExists(tokenAddress);

        // Read the Safe's actual Guard storage slot.
        String storageValue = web3j.ethGetStorageAt(
                safeAddress,
                GUARD_STORAGE_SLOT,
                DefaultBlockParameterName.LATEST
        ).send().getData();

        String installedGuardAddress = decodeAddress(storageValue);

        boolean guardInstalled =
                installedGuardAddress.equalsIgnoreCase(guardAddress);

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("connected", true);

        result.put("chainId", actualChainId);
        result.put("expectedChainId", expectedChainId);
        result.put("correctNetwork", actualChainId == expectedChainId);

        result.put("latestBlock", latestBlock);

        result.put("safeAddress", safeAddress);
        result.put("safeExists", safeExists);

        result.put("guardAddress", guardAddress);
        result.put("guardExists", guardExists);

        result.put("installedGuardAddress", installedGuardAddress);
        result.put("guardInstalled", guardInstalled);

        result.put("payeeRegistryAddress", registryAddress);
        result.put("payeeRegistryExists", registryExists);

        result.put("tokenAddress", tokenAddress);
        result.put("tokenExists", tokenExists);

        boolean allContractsExist =
                safeExists &&
                        guardExists &&
                        registryExists &&
                        tokenExists;

        boolean fullyConfigured =
                actualChainId == expectedChainId &&
                        allContractsExist &&
                        guardInstalled;

        result.put(
                "status",
                fullyConfigured ? "CONNECTED" : "CONFIGURATION_ERROR"
        );

        return result;
    }

    private boolean contractExists(String address) throws Exception {

        String code = web3j.ethGetCode(
                address,
                DefaultBlockParameterName.LATEST
        ).send().getCode();

        return code != null &&
                !code.equals("0x") &&
                !code.equals("0x0");
    }

    private String decodeAddress(String storageValue) {

        if (storageValue == null) {
            return "0x0000000000000000000000000000000000000000";
        }

        String normalized = storageValue.startsWith("0x")
                ? storageValue.substring(2)
                : storageValue;

        if (normalized.length() < 40) {
            return "0x0000000000000000000000000000000000000000";
        }

        String address = normalized.substring(normalized.length() - 40);

        return "0x" + address.toLowerCase();
    }
}
