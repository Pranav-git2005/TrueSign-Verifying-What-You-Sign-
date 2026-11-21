package com.truesign.blockchain;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;

import java.math.BigInteger;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class BlockchainService {
    private static final BigInteger GUARD_STORAGE_SLOT = new BigInteger(
            "4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8", 16);
    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    private final Web3j web3j;

    @Value("${truesign.blockchain.chain-id:0}")
    private long expectedChainId;
    @Value("${truesign.contracts.safe-address:}")
    private String safeAddress;
    @Value("${truesign.contracts.guard-address:}")
    private String guardAddress;
    @Value("${truesign.contracts.payee-registry-address:}")
    private String registryAddress;
    @Value("${truesign.contracts.token-address:}")
    private String tokenAddress;

    public BlockchainService(Web3j web3j) { this.web3j = web3j; }

    /** Always returns a status document. RPC failure is represented as connected=false, not HTTP 500. */
    public Map<String, Object> getStatus() {
        Map<String, Object> result = baseStatus();
        try {
            long actualChainId = web3j.ethChainId().send().getChainId().longValueExact();
            String latestBlock = web3j.ethBlockNumber().send().getBlockNumber().toString();
            boolean safeExists = contractExists(safeAddress);
            boolean guardExists = contractExists(guardAddress);
            boolean registryExists = contractExists(registryAddress);
            boolean tokenExists = contractExists(tokenAddress);
            String installedGuardAddress = ZERO_ADDRESS;
            if (isAddress(safeAddress)) {
                String storageValue = web3j.ethGetStorageAt(
                        safeAddress, GUARD_STORAGE_SLOT, DefaultBlockParameterName.LATEST
                ).send().getData();
                installedGuardAddress = decodeAddress(storageValue);
            }
            boolean guardInstalled = isAddress(guardAddress)
                    && installedGuardAddress.equalsIgnoreCase(guardAddress);

            result.put("connected", true);
            result.put("chainId", actualChainId);
            result.put("correctNetwork", actualChainId == expectedChainId);
            result.put("latestBlock", latestBlock);
            result.put("safeExists", safeExists);
            result.put("guardExists", guardExists);
            result.put("installedGuardAddress", installedGuardAddress);
            result.put("guardInstalled", guardInstalled);
            result.put("payeeRegistryExists", registryExists);
            result.put("tokenExists", tokenExists);
            boolean configured = actualChainId == expectedChainId && safeExists
                    && guardExists && registryExists && tokenExists && guardInstalled;
            result.put("status", configured ? "CONNECTED" : "CONFIGURATION_ERROR");
            result.put("rpcError", null);
        } catch (Exception ex) {
            result.put("connected", false);
            result.put("status", "RPC_UNAVAILABLE");
            result.put("rpcError", safeMessage(ex));
        }
        result.put("checkedAt", Instant.now().toString());
        return result;
    }

    private Map<String, Object> baseStatus() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("connected", false);
        result.put("chainId", null);
        result.put("expectedChainId", expectedChainId);
        result.put("correctNetwork", false);
        result.put("latestBlock", null);
        result.put("safeAddress", safeAddress);
        result.put("safeExists", null);
        result.put("guardAddress", guardAddress);
        result.put("guardExists", null);
        result.put("installedGuardAddress", null);
        result.put("guardInstalled", null);
        result.put("payeeRegistryAddress", registryAddress);
        result.put("payeeRegistryExists", null);
        result.put("tokenAddress", tokenAddress);
        result.put("tokenExists", null);
        result.put("status", "CHECKING");
        result.put("rpcError", null);
        return result;
    }

    private boolean contractExists(String address) throws Exception {
        if (!isAddress(address)) return false;
        String code = web3j.ethGetCode(address, DefaultBlockParameterName.LATEST).send().getCode();
        return code != null && !"0x".equalsIgnoreCase(code) && !"0x0".equalsIgnoreCase(code);
    }

    private boolean isAddress(String value) {
        return value != null && value.matches("0x[0-9a-fA-F]{40}");
    }

    private String decodeAddress(String storageValue) {
        if (storageValue == null) return ZERO_ADDRESS;
        String normalized = storageValue.startsWith("0x") ? storageValue.substring(2) : storageValue;
        if (normalized.length() < 40) return ZERO_ADDRESS;
        return "0x" + normalized.substring(normalized.length() - 40).toLowerCase();
    }

    private String safeMessage(Exception ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? ex.getClass().getSimpleName() : message;
    }
}
