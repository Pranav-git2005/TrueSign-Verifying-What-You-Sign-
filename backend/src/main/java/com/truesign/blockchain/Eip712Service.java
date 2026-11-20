package com.truesign.blockchain;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

@Service
public class Eip712Service {

    private static final String DOMAIN_TYPE =
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

    private static final String ATTESTATION_TYPE =
            "TrueSignAttestation(address safe,bytes32 safeTxHash,uint256 expiry)";

    private static final String DOMAIN_NAME = "TrueSignGuard";
    private static final String DOMAIN_VERSION = "1";

    private static final long MAX_ATTESTATION_LIFETIME_SECONDS = 3600L;

    private final Web3j web3j;
    private final String guardAddress;
    private final long configuredChainId;

    private final byte[] domainTypeHash;
    private final byte[] attestationTypeHash;
    private final byte[] nameHash;
    private final byte[] versionHash;

    public Eip712Service(
            Web3j web3j,
            @Value("${truesign.contracts.guard-address}") String guardAddress,
            @Value("${truesign.blockchain.chain-id}") long configuredChainId
    ) {
        this.web3j = web3j;
        this.guardAddress = normalizeAddress(guardAddress);
        this.configuredChainId = configuredChainId;

        this.domainTypeHash = keccak(DOMAIN_TYPE);
        this.attestationTypeHash = keccak(ATTESTATION_TYPE);
        this.nameHash = keccak(DOMAIN_NAME);
        this.versionHash = keccak(DOMAIN_VERSION);
    }

    /**
     * Represents one verifier's EIP-712 signature.
     */
    public record AttestationSignature(
            String signer,
            String digest,
            String signature,
            long expiry
    ) {}

    /**
     * Creates the exact EIP-712 domain separator used by TrueSignGuard.sol.
     */
    public String getDomainSeparator() throws Exception {

        BigInteger chainId = getChainId();

        String safeAddress = getSafeAccount();

        byte[] encoded = concat(
                domainTypeHash,
                nameHash,
                versionHash,
                uint256Word(chainId),
                addressWord(guardAddress)
        );

        return toHex(keccak(encoded));
    }

    /**
     * Calculates:
     *
     * keccak256(
     *   0x1901 ||
     *   domainSeparator ||
     *   structHash
     * )
     *
     * This matches TrueSignGuard.getAttestationDigest().
     */
    public String getAttestationDigest(
            String safeTxHash,
            long expiry
    ) throws Exception {

        validateTransactionHash(safeTxHash);
        validateExpiry(expiry);

        String safeAddress = getSafeAccount();

        byte[] structHash = keccak(concat(
                attestationTypeHash,
                addressWord(safeAddress),
                bytes32Word(safeTxHash),
                uint256Word(BigInteger.valueOf(expiry))
        ));

        byte[] domainSeparator = Numeric.hexStringToByteArray(
                getDomainSeparator()
        );

        byte[] digest = keccak(concat(
                new byte[]{0x19, 0x01},
                domainSeparator,
                structHash
        ));

        return toHex(digest);
    }

    /**
     * Signs the raw EIP-712 digest.
     *
     * IMPORTANT:
     * The third argument to signMessage is false.
     * This prevents adding the Ethereum personal-message prefix.
     */
    public AttestationSignature signAttestation(
            String safeTxHash,
            long expiry,
            String privateKeyHex
    ) throws Exception {

        validateTransactionHash(safeTxHash);
        validateExpiry(expiry);

        if (privateKeyHex == null || privateKeyHex.isBlank()) {
            throw new IllegalArgumentException("Verifier private key is required.");
        }

        String cleanKey = Numeric.cleanHexPrefix(privateKeyHex.trim());

        BigInteger privateKey;

        try {
            privateKey = new BigInteger(cleanKey, 16);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid verifier private key.");
        }

        if (privateKey.signum() <= 0) {
            throw new IllegalArgumentException("Verifier private key must be positive.");
        }

        ECKeyPair keyPair = ECKeyPair.create(privateKey);

        String signer = Keys.toChecksumAddress(
                Keys.getAddress(keyPair.getPublicKey())
        );

        // Only registered verifier signers may sign attestations.
        if (!isRegisteredVerifier(signer)) {
            throw new SecurityException(
                    "The derived signer is not registered in TrueSignGuard: " + signer
            );
        }

        byte[] digest = Numeric.hexStringToByteArray(
                getAttestationDigest(safeTxHash, expiry)
        );

        Sign.SignatureData signatureData = Sign.signMessage(
                digest,
                keyPair,
                false
        );

        byte[] r = signatureData.getR();
        byte[] s = signatureData.getS();
        int v = Byte.toUnsignedInt(signatureData.getV()[0]);

        if (v == 0 || v == 1) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            throw new IllegalStateException("Unexpected ECDSA recovery value: " + v);
        }

        String signature = "0x"
                + Numeric.toHexStringNoPrefix(r)
                + Numeric.toHexStringNoPrefix(s)
                + String.format("%02x", v);

        // Confirm that the generated signature recovers the expected signer.
        String recovered = recoverSigner(
                digest,
                signatureData
        );

        if (!recovered.equalsIgnoreCase(signer)) {
            throw new SecurityException(
                    "Generated signature did not recover the expected verifier address."
            );
        }

        return new AttestationSignature(
                signer,
                toHex(digest),
                signature,
                expiry
        );
    }

    /**
     * Verifies an EIP-712 signature and returns its recovered signer.
     */
    public String recoverSigner(
            String digestHex,
            String signatureHex
    ) throws Exception {

        byte[] digest = Numeric.hexStringToByteArray(digestHex);
        byte[] signature = Numeric.hexStringToByteArray(signatureHex);

        if (digest.length != 32) {
            throw new IllegalArgumentException("EIP-712 digest must be 32 bytes.");
        }

        if (signature.length != 65) {
            throw new IllegalArgumentException("ECDSA signature must be 65 bytes.");
        }

        byte v = signature[64];

        int recovery = Byte.toUnsignedInt(v);

        if (recovery == 0 || recovery == 1) {
            v = (byte) (recovery + 27);
        }

        if (Byte.toUnsignedInt(v) != 27 && Byte.toUnsignedInt(v) != 28) {
            throw new IllegalArgumentException("Invalid ECDSA recovery value.");
        }

        byte[] r = Arrays.copyOfRange(signature, 0, 32);
        byte[] s = Arrays.copyOfRange(signature, 32, 64);

        Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);

        BigInteger publicKey = Sign.signedMessageToKey(
                digest,
                signatureData
        );

        return Keys.toChecksumAddress(Keys.getAddress(publicKey));
    }

    /**
     * Checks whether an address is an authorized verifier in the Guard.
     */
    public boolean isRegisteredVerifier(String address) throws Exception {

        String normalized = normalizeAddress(address);

        String selector = functionSelector("isVerifier(address)");

        String calldata = selector + Numeric.cleanHexPrefix(
                Numeric.toHexString(addressWord(normalized))
        );

        String result = ethCall(calldata);

        if (result.length() < 64) {
            throw new IllegalStateException("Invalid isVerifier response.");
        }

        return new BigInteger(result, 16).equals(BigInteger.ONE);
    }

    /**
     * Cross-checks the Java digest against the deployed Solidity contract.
     */
    public boolean verifyDigestAgainstContract(
            String safeTxHash,
            long expiry
    ) throws Exception {

        validateTransactionHash(safeTxHash);
        validateExpiry(expiry);

        String selector = functionSelector(
                "getAttestationDigest(bytes32,uint256)"
        );

        String calldata = selector
                + Numeric.cleanHexPrefix(
                        Numeric.toHexString(bytes32Word(safeTxHash))
                )
                + Numeric.cleanHexPrefix(
                        Numeric.toHexString(uint256Word(BigInteger.valueOf(expiry)))
                );

        String contractDigest = ethCall(calldata);

        String javaDigest = Numeric.cleanHexPrefix(
                getAttestationDigest(safeTxHash, expiry)
        );

        return contractDigest.equalsIgnoreCase(javaDigest);
    }

    /**
     * Reads the Safe account configured in the deployed Guard.
     */
    public String getSafeAccount() throws Exception {

        String selector = functionSelector("safeAccount()");
        String result = ethCall(selector);

        if (result.length() < 64) {
            throw new IllegalStateException("Invalid Safe account response.");
        }

        String address = "0x" + result.substring(result.length() - 40);

        return normalizeAddress(address);
    }

    public BigInteger getChainId() throws Exception {

        BigInteger actualChainId = web3j.ethChainId()
                .send()
                .getChainId();

        if (!actualChainId.equals(BigInteger.valueOf(configuredChainId))) {
            throw new IllegalStateException(
                    "Wrong blockchain network. Expected chain ID "
                            + configuredChainId
                            + " but connected to "
                            + actualChainId
            );
        }

        return actualChainId;
    }

    /**
     * Returns signatures sorted by recovered signer address.
     *
     * TrueSignGuard requires strictly ascending signer addresses.
     */
    public List<AttestationSignature> sortSignatures(
            List<AttestationSignature> signatures
    ) {

        if (signatures == null || signatures.size() != 2) {
            throw new IllegalArgumentException(
                    "Exactly two verifier signatures are required."
            );
        }

        List<AttestationSignature> sorted = signatures.stream()
                .sorted(Comparator.comparing(
                        signature -> normalizeAddress(signature.signer())
                ))
                .toList();

        if (sorted.get(0).signer().equalsIgnoreCase(sorted.get(1).signer())) {
            throw new IllegalArgumentException(
                    "Verifier quorum requires two distinct signers."
            );
        }

        return sorted;
    }

    private String recoverSigner(
            byte[] digest,
            Sign.SignatureData signatureData
    ) throws Exception {

        BigInteger publicKey = Sign.signedMessageToKey(
                digest,
                signatureData
        );

        return Keys.toChecksumAddress(Keys.getAddress(publicKey));
    }

    private String ethCall(String calldata) throws Exception {

        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        null,
                        guardAddress,
                        "0x" + Numeric.cleanHexPrefix(calldata)
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            throw new IllegalStateException(
                    "TrueSignGuard RPC call failed: "
                            + response.getError().getMessage()
            );
        }

        String value = Numeric.cleanHexPrefix(response.getValue());

        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "TrueSignGuard returned empty data. Check deployment address."
            );
        }

        return value;
    }

    private void validateExpiry(long expiry) {

        long now = Instant.now().getEpochSecond();

        if (expiry <= now) {
            throw new IllegalArgumentException(
                    "Attestation expiry must be in the future."
            );
        }

        if (expiry > now + MAX_ATTESTATION_LIFETIME_SECONDS) {
            throw new IllegalArgumentException(
                    "Attestation expiry cannot exceed one hour."
            );
        }
    }

    private void validateTransactionHash(String hash) {

        if (hash == null ||
                !hash.matches("(?i)^0x[a-f0-9]{64}$")) {
            throw new IllegalArgumentException(
                    "Safe transaction hash must be a 32-byte hex value."
            );
        }
    }

    private String normalizeAddress(String address) {

        if (address == null ||
                !address.matches("(?i)^0x[a-f0-9]{40}$")) {
            throw new IllegalArgumentException("Invalid Ethereum address.");
        }

        return address.toLowerCase();
    }

    private byte[] keccak(String value) {
        return Hash.sha3(value.getBytes(StandardCharsets.UTF_8));
    }

    private byte[] keccak(byte[] value) {
        return Hash.sha3(value);
    }

    private byte[] uint256Word(BigInteger value) {

        if (value == null || value.signum() < 0 || value.bitLength() > 256) {
            throw new IllegalArgumentException("Value is outside uint256 range.");
        }

        byte[] raw = Numeric.toBytesPadded(value, 32);

        if (raw.length != 32) {
            throw new IllegalStateException("Invalid uint256 encoding.");
        }

        return raw;
    }

    private byte[] addressWord(String address) {

        byte[] raw = Numeric.hexStringToByteArray(
                normalizeAddress(address)
        );

        byte[] word = new byte[32];

        System.arraycopy(raw, 0, word, 12, 20);

        return word;
    }

    private byte[] bytes32Word(String value) {

        String clean = Numeric.cleanHexPrefix(value);

        if (clean == null || !clean.matches("(?i)^[a-f0-9]{64}$")) {
            throw new IllegalArgumentException("Value must be exactly 32 bytes.");
        }

        return Numeric.hexStringToByteArray(clean);
    }

    private String functionSelector(String signature) {

        byte[] hash = keccak(signature);

        return Numeric.toHexStringNoPrefix(
                Arrays.copyOfRange(hash, 0, 4)
        );
    }

    private byte[] concat(byte[]... arrays) {

        int length = 0;

        for (byte[] array : arrays) {
            length += array.length;
        }

        byte[] result = new byte[length];

        int offset = 0;

        for (byte[] array : arrays) {
            System.arraycopy(array, 0, result, offset, array.length);
            offset += array.length;
        }

        return result;
    }

    private String toHex(byte[] value) {
        return Numeric.toHexString(value);
    }
}