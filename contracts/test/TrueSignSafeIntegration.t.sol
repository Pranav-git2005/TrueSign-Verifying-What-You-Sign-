
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";
import {
    SafeProxyFactory
} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {Enum} from "safe-contracts/contracts/libraries/Enum.sol";

import {TrueSignGuard} from "../src/TrueSignGuard.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";

contract TrueSignSafeIntegrationTest is Test {
    // --------------------------------------------------
    // PRIVATE KEYS
    // --------------------------------------------------

    uint256 internal constant OWNER_KEY_1 = 0x1111;
    uint256 internal constant OWNER_KEY_2 = 0x2222;

    uint256 internal constant VERIFIER_KEY_1 = 0xA11CE;
    uint256 internal constant VERIFIER_KEY_2 = 0xB0B;
    uint256 internal constant VERIFIER_KEY_3 = 0xCAFE;

    // --------------------------------------------------
    // CONTRACTS
    // --------------------------------------------------

    Safe internal singleton;
    SafeProxyFactory internal factory;
    Safe internal safe;
    TrueSignGuard internal guard;
    PayeeRegistry internal payeeRegistry;

    // --------------------------------------------------
    // ADDRESSES
    // --------------------------------------------------

    address internal owner1;
    address internal owner2;

    address internal verifier1;
    address internal verifier2;
    address internal verifier3;

    address internal recipient;

    // --------------------------------------------------
    // SETUP
    // --------------------------------------------------

    function setUp() public {
        owner1 = vm.addr(OWNER_KEY_1);
        owner2 = vm.addr(OWNER_KEY_2);

        verifier1 = vm.addr(VERIFIER_KEY_1);
        verifier2 = vm.addr(VERIFIER_KEY_2);
        verifier3 = vm.addr(VERIFIER_KEY_3);

        recipient = address(0xBEEF);

        // Deploy actual Safe singleton.
        singleton = new Safe();

        // Deploy actual Safe proxy factory.
        factory = new SafeProxyFactory();

        // Prepare Safe owners.
        address[] memory owners = new address[](2);
        owners[0] = owner1;
        owners[1] = owner2;

        // Initialize the Safe proxy.
        bytes memory initializer = abi.encodeCall(
            Safe.setup,
            (
                owners,
                uint256(2),
                address(0),
                bytes(""),
                address(0),
                address(0),
                uint256(0),
                payable(address(0))
            )
        );

        // Deploy and initialize the actual Safe proxy.
        SafeProxy proxy = factory.createProxyWithNonce(
            address(singleton),
            initializer,
            1
        );

        safe = Safe(payable(address(proxy)));

        // Deploy PayeeRegistry with a 24-hour cooldown.
        payeeRegistry = new PayeeRegistry(24 hours);

        // Deploy TrueSignGuard.
        address[3] memory verifiers = [
            verifier1,
            verifier2,
            verifier3
        ];

        guard = new TrueSignGuard(
            address(safe),
            verifiers,
            address(payeeRegistry)
        );

        // Fund the Safe for native ETH transfer tests.
        vm.deal(address(safe), 5 ether);

        // Install guard using a genuine Safe owner transaction.
        _installGuard();
    }

    // --------------------------------------------------
    // SAFE OWNER SIGNATURES
    // --------------------------------------------------

    function _ownerSignatures(
        bytes32 txHash
    ) internal returns (bytes memory signatures) {
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(
            OWNER_KEY_1,
            txHash
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(
            OWNER_KEY_2,
            txHash
        );

        bytes memory signature1 = abi.encodePacked(
            r1,
            s1,
            v1
        );

        bytes memory signature2 = abi.encodePacked(
            r2,
            s2,
            v2
        );

        // Safe requires owner signatures in ascending
        // signer-address order.
        if (owner1 < owner2) {
            signatures = bytes.concat(
                signature1,
                signature2
            );
        } else {
            signatures = bytes.concat(
                signature2,
                signature1
            );
        }
    }

    // --------------------------------------------------
    // VERIFIER SIGNATURES
    // --------------------------------------------------

    function _verifierSignatures(
        bytes32 digest
    ) internal returns (bytes[] memory signatures) {
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(
            VERIFIER_KEY_1,
            digest
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(
            VERIFIER_KEY_2,
            digest
        );

        address signer1 = vm.addr(VERIFIER_KEY_1);
        address signer2 = vm.addr(VERIFIER_KEY_2);

        bytes memory signature1 = abi.encodePacked(
            r1,
            s1,
            v1
        );

        bytes memory signature2 = abi.encodePacked(
            r2,
            s2,
            v2
        );

        signatures = new bytes[](2);

        if (signer1 < signer2) {
            signatures[0] = signature1;
            signatures[1] = signature2;
        } else {
            signatures[0] = signature2;
            signatures[1] = signature1;
        }
    }

    // --------------------------------------------------
    // TRANSACTION HASH
    // --------------------------------------------------

    function _safeTxHash(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 nonce
    ) internal view returns (bytes32) {
        return safe.getTransactionHash(
            to,
            value,
            data,
            operation,
            0,
            0,
            0,
            address(0),
            address(0),
            nonce
        );
    }

    // --------------------------------------------------
    // GUARD INSTALLATION
    // --------------------------------------------------

    function _installGuard() internal {
        bytes memory data = abi.encodeWithSignature(
            "setGuard(address)",
            address(guard)
        );

        bytes32 txHash = _safeTxHash(
            address(safe),
            0,
            data,
            Enum.Operation.Call,
            safe.nonce()
        );

        bytes memory signatures = _ownerSignatures(txHash);

        bool success = safe.execTransaction(
            address(safe),
            0,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            signatures
        );

        assertTrue(success);
    }

    // --------------------------------------------------
    // ATTESTATION SUBMISSION
    // --------------------------------------------------

    function _approveTransaction(
        bytes32 txHash
    ) internal {
        uint256 expiry = block.timestamp + 30 minutes;

        bytes32 digest = guard.getAttestationDigest(
            txHash,
            expiry
        );

        bytes[] memory signatures = _verifierSignatures(
            digest
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    // --------------------------------------------------
    // TEST 1: REAL SAFE DEPLOYMENT
    // --------------------------------------------------

    function testDeploysRealSafeProxy() public view {
        assertEq(safe.VERSION(), "1.5.0");

        assertEq(safe.getThreshold(), 2);

        assertEq(safe.getOwners().length, 2);

        assertEq(safe.nonce(), 1);
    }

    // --------------------------------------------------
    // TEST 2: GUARD INSTALLATION
    // --------------------------------------------------

    function testInstallsTrueSignGuard() public view {
        assertTrue(
            guard.supportsInterface(
                0xe6d7a83a
            )
        );

        assertEq(
            address(safe),
            address(guard.safeAccount())
        );
    }

    // --------------------------------------------------
    // TEST 3: APPROVED TRANSACTION
    // --------------------------------------------------

    function testExecutesApprovedTransaction() public {
        uint256 amount = 1 ether;

        uint256 nonce = safe.nonce();

        bytes32 txHash = _safeTxHash(
            recipient,
            amount,
            "",
            Enum.Operation.Call,
            nonce
        );

        // Verifiers approve the exact Safe transaction hash.
        _approveTransaction(txHash);

        // Safe owners sign the same transaction hash.
        bytes memory ownerSignatures = _ownerSignatures(
            txHash
        );

        uint256 balanceBefore = recipient.balance;

        bool success = safe.execTransaction(
            recipient,
            amount,
            "",
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            ownerSignatures
        );

        assertTrue(success);

        assertEq(
            recipient.balance,
            balanceBefore + amount
        );

        assertTrue(guard.consumed(txHash));
    }

    // --------------------------------------------------
    // TEST 4: UNAPPROVED TRANSACTION
    // --------------------------------------------------

    function testRejectsUnapprovedTransaction() public {
        bytes32 txHash = _safeTxHash(
            recipient,
            1 ether,
            "",
            Enum.Operation.Call,
            safe.nonce()
        );

        bytes memory ownerSignatures = _ownerSignatures(
            txHash
        );

        vm.expectRevert(
            TrueSignGuard.AttestationNotFound.selector
        );

        safe.execTransaction(
            recipient,
            1 ether,
            "",
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            ownerSignatures
        );
    }

    // --------------------------------------------------
    // TEST 5: TAMPERED TRANSACTION
    // --------------------------------------------------

    function testRejectsModifiedTransaction() public {
        address intendedRecipient = address(0xAAAA);
        address attacker = address(0xBBBB);

        uint256 amount = 1 ether;
        uint256 nonce = safe.nonce();

        // Passport/verifiers approve intended recipient.
        bytes32 approvedHash = _safeTxHash(
            intendedRecipient,
            amount,
            "",
            Enum.Operation.Call,
            nonce
        );

        _approveTransaction(approvedHash);

        // Owner signatures are valid for the attacker's
        // transaction, but verifier approval is not.
        bytes32 attackerHash = _safeTxHash(
            attacker,
            amount,
            "",
            Enum.Operation.Call,
            nonce
        );

        bytes memory ownerSignatures = _ownerSignatures(
            attackerHash
        );

        vm.expectRevert(
            TrueSignGuard.AttestationNotFound.selector
        );

        safe.execTransaction(
            attacker,
            amount,
            "",
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            ownerSignatures
        );
    }

    // --------------------------------------------------
    // TEST 6: DELEGATECALL REJECTION
    // --------------------------------------------------

    function testRejectsDelegateCallThroughRealSafe() public {
        address target = address(0xCAFE);

        uint256 nonce = safe.nonce();

        bytes32 txHash = _safeTxHash(
            target,
            0,
            "",
            Enum.Operation.DelegateCall,
            nonce
        );

        bytes memory ownerSignatures = _ownerSignatures(
            txHash
        );

        vm.expectRevert(
            TrueSignGuard.DelegateCallNotAllowed.selector
        );

        safe.execTransaction(
            target,
            0,
            "",
            Enum.Operation.DelegateCall,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            ownerSignatures
        );
    }
}
