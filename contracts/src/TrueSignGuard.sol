
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    BaseTransactionGuard
} from "safe-contracts/contracts/base/GuardManager.sol";

import {
    Enum
} from "safe-contracts/contracts/libraries/Enum.sol";

import {PayeeRegistry} from "./PayeeRegistry.sol";

interface ISafeTransactionHash {
    function nonce() external view returns (uint256);

    function getTransactionHash(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
}

contract TrueSignGuard is BaseTransactionGuard {
    // --------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------

    address public immutable safeAccount;
    PayeeRegistry public immutable payeeRegistry;

    uint256 public constant REQUIRED_VERIFIERS = 2;

    uint256 public constant MAX_ATTESTATION_LIFETIME = 1 hours;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    bytes32 private constant ATTESTATION_TYPEHASH =
        keccak256(
            "TrueSignAttestation(address safe,bytes32 safeTxHash,uint256 expiry)"
        );

    uint256 private constant SECP256K1_HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    // --------------------------------------------------
    // VERIFIER MANAGEMENT
    // --------------------------------------------------

    address[3] public verifierSigners;

    mapping(address => bool) public isVerifier;

    // --------------------------------------------------
    // ATTESTATION STORAGE
    // --------------------------------------------------

    mapping(bytes32 => uint256) public approvedExpiry;

    mapping(bytes32 => bool) public consumed;

    // --------------------------------------------------
    // EVENTS
    // --------------------------------------------------

    event AttestationSubmitted(
        bytes32 indexed safeTxHash,
        uint256 expiry
    );

    event TransactionApproved(
        bytes32 indexed safeTxHash,
        address indexed safeAccount
    );

    event TransactionExecutionResult(
        bytes32 indexed safeTxHash,
        bool success
    );

    // --------------------------------------------------
    // ERRORS
    // --------------------------------------------------

    error InvalidSafe();
    error InvalidVerifier();
    error DuplicateVerifier();
    error InvalidSignatureCount();
    error InvalidSignature();
    error InvalidSignatureOrder();
    error InsufficientVerifierQuorum();
    error InvalidExpiry();
    error AttestationAlreadyExists();
    error AttestationNotFound();
    error AttestationExpired();
    error AttestationAlreadyConsumed();
    error DelegateCallNotAllowed();
    error InvalidSafeNonce();

    error InvalidPayeeRegistry();
    error NewPayeeCooldown();
    error UnsupportedPaymentCall();

    // --------------------------------------------------
    // CONSTRUCTOR
    // --------------------------------------------------

    constructor(
        address _safeAccount,
        address[3] memory _verifiers,
        address _payeeRegistry
    ) {
        if (_safeAccount == address(0)) {
            revert InvalidSafe();
        }

        if (
            _payeeRegistry == address(0) ||
            _payeeRegistry.code.length == 0
        ) {
            revert InvalidPayeeRegistry();
        }

        safeAccount = _safeAccount;
        payeeRegistry = PayeeRegistry(_payeeRegistry);

        for (uint256 i = 0; i < 3; i++) {
            address verifier = _verifiers[i];

            if (verifier == address(0)) {
                revert InvalidVerifier();
            }

            if (isVerifier[verifier]) {
                revert DuplicateVerifier();
            }

            verifierSigners[i] = verifier;
            isVerifier[verifier] = true;
        }
    }

    // --------------------------------------------------
    // EIP-712 DOMAIN
    // --------------------------------------------------

    function domainSeparator()
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("TrueSignGuard")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function getAttestationDigest(
        bytes32 safeTxHash,
        uint256 expiry
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH,
                safeAccount,
                safeTxHash,
                expiry
            )
        );

        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator(),
                structHash
            )
        );
    }

    // --------------------------------------------------
    // SIGNATURE VALIDATION
    // --------------------------------------------------

    function recoverSigner(
        bytes calldata signature,
        bytes32 digest
    ) internal pure returns (address signer) {
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (
            uint256(s) == 0 ||
            uint256(s) > SECP256K1_HALF_ORDER ||
            (v != 27 && v != 28)
        ) {
            revert InvalidSignature();
        }

        signer = ecrecover(digest, v, r, s);

        if (signer == address(0)) {
            revert InvalidSignature();
        }
    }

    // --------------------------------------------------
    // SUBMIT VERIFIER ATTESTATIONS
    // --------------------------------------------------

    function submitAttestation(
        bytes32 safeTxHash,
        uint256 expiry,
        bytes[] calldata signatures
    ) external {
        if (expiry <= block.timestamp) {
            revert InvalidExpiry();
        }

        if (
            expiry > block.timestamp + MAX_ATTESTATION_LIFETIME
        ) {
            revert InvalidExpiry();
        }

        if (signatures.length != REQUIRED_VERIFIERS) {
            revert InvalidSignatureCount();
        }

        if (consumed[safeTxHash]) {
            revert AttestationAlreadyConsumed();
        }

        if (approvedExpiry[safeTxHash] != 0) {
            revert AttestationAlreadyExists();
        }

        bytes32 digest = getAttestationDigest(
            safeTxHash,
            expiry
        );

        address previousSigner = address(0);

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(
                signatures[i],
                digest
            );

            if (!isVerifier[signer]) {
                revert InvalidVerifier();
            }

            // Enforces unique, sorted signer addresses.
            if (signer <= previousSigner) {
                revert InvalidSignatureOrder();
            }

            previousSigner = signer;
        }

        approvedExpiry[safeTxHash] = expiry;

        emit AttestationSubmitted(safeTxHash, expiry);
    }

    // --------------------------------------------------
    // SAFE PRE-EXECUTION CHECK
    // --------------------------------------------------

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory,
        address
    ) external override {
        if (msg.sender != safeAccount) {
            revert InvalidSafe();
        }

        if (operation == Enum.Operation.DelegateCall) {
            revert DelegateCallNotAllowed();
        }

        uint256 currentNonce = ISafeTransactionHash(
            safeAccount
        ).nonce();

        if (currentNonce == 0) {
            revert InvalidSafeNonce();
        }

        // Safe increments its nonce before calling the guard.
        uint256 transactionNonce = currentNonce - 1;

        bytes32 safeTxHash = ISafeTransactionHash(
            safeAccount
        ).getTransactionHash(
            to,
            value,
            data,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            transactionNonce
        );

        uint256 expiry = approvedExpiry[safeTxHash];

        if (expiry == 0) {
            revert AttestationNotFound();
        }

        if (block.timestamp >= expiry) {
            revert AttestationExpired();
        }

        if (consumed[safeTxHash]) {
            revert AttestationAlreadyConsumed();
        }

        // Consume approval before the transaction executes.
        consumed[safeTxHash] = true;

        delete approvedExpiry[safeTxHash];

        emit TransactionApproved(
            safeTxHash,
            safeAccount
        );
    }

    // --------------------------------------------------
    // SAFE POST-EXECUTION CHECK
    // --------------------------------------------------

    function checkAfterExecution(
        bytes32 txHash,
        bool success
    ) external override {
        if (msg.sender != safeAccount) {
            revert InvalidSafe();
        }

        emit TransactionExecutionResult(txHash, success);
    }
}

