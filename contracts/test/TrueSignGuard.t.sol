
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TrueSignGuard} from "../src/TrueSignGuard.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {Enum} from "safe-contracts/contracts/libraries/Enum.sol";

// --------------------------------------------------
// MOCK SAFE ACCOUNT
// --------------------------------------------------

contract MockSafeForGuard {
    uint256 public nonce = 1;

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
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encode(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                _nonce
            )
        );
    }

    function invokeGuard(
        TrueSignGuard guard,
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external {
        guard.checkTransaction(
            to,
            value,
            data,
            operation,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            "",
            msg.sender
        );
    }
}

// --------------------------------------------------
// TEST CONTRACT
// --------------------------------------------------

contract TrueSignGuardTest is Test {
    MockSafeForGuard internal safe;
    TrueSignGuard internal guard;
    PayeeRegistry internal payeeRegistry;

    uint256 internal constant KEY_1 = 0xA11CE;
    uint256 internal constant KEY_2 = 0xB0B;
    uint256 internal constant KEY_3 = 0xCAFE;
    uint256 internal constant UNAUTHORIZED_KEY = 0xDEAD;

    address internal verifier1;
    address internal verifier2;
    address internal verifier3;

    address internal unauthorizedVerifier;

    address internal recipient = address(0x1234);

    function setUp() public {
        safe = new MockSafeForGuard();

        verifier1 = vm.addr(KEY_1);
        verifier2 = vm.addr(KEY_2);
        verifier3 = vm.addr(KEY_3);

        unauthorizedVerifier = vm.addr(UNAUTHORIZED_KEY);

        address[3] memory verifiers = [
            verifier1,
            verifier2,
            verifier3
        ];

        // Deploy registry with a 24-hour cooldown.
        payeeRegistry = new PayeeRegistry(24 hours);

        guard = new TrueSignGuard(
            address(safe),
            verifiers,
            address(payeeRegistry)
        );
    }

    // --------------------------------------------------
    // SIGNATURE HELPERS
    // --------------------------------------------------

    function _sign(
        uint256 privateKey,
        bytes32 digest
    ) internal returns (address signer, bytes memory signature) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            privateKey,
            digest
        );

        signer = vm.addr(privateKey);

        signature = abi.encodePacked(r, s, v);
    }

    function _twoSignatures(
        bytes32 digest,
        uint256 keyA,
        uint256 keyB
    ) internal returns (bytes[] memory signatures) {
        (address signerA, bytes memory sigA) = _sign(
            keyA,
            digest
        );

        (address signerB, bytes memory sigB) = _sign(
            keyB,
            digest
        );

        signatures = new bytes[](2);

        if (signerA < signerB) {
            signatures[0] = sigA;
            signatures[1] = sigB;
        } else {
            signatures[0] = sigB;
            signatures[1] = sigA;
        }
    }

    function _transactionHash() internal view returns (bytes32) {
        return safe.getTransactionHash(
            recipient,
            0,
            "",
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            0
        );
    }

    function _submitValidAttestation(
        bytes32 txHash,
        uint256 expiry
    ) internal {
        bytes32 digest = guard.getAttestationDigest(
            txHash,
            expiry
        );

        bytes[] memory signatures = _twoSignatures(
            digest,
            KEY_1,
            KEY_2
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    // --------------------------------------------------
    // CONSTRUCTOR TESTS
    // --------------------------------------------------

    function testConstructorRegistersThreeVerifiers() public view {
        assertTrue(guard.isVerifier(verifier1));
        assertTrue(guard.isVerifier(verifier2));
        assertTrue(guard.isVerifier(verifier3));
    }

    function testConstructorRejectsZeroSafe() public {
        address[3] memory verifiers = [
            verifier1,
            verifier2,
            verifier3
        ];

        vm.expectRevert(TrueSignGuard.InvalidSafe.selector);

        new TrueSignGuard(
            address(0),
            verifiers,
            address(payeeRegistry)
        );
    }

    function testConstructorRejectsDuplicateVerifier() public {
        address[3] memory verifiers = [
            verifier1,
            verifier1,
            verifier3
        ];

        vm.expectRevert(
            TrueSignGuard.DuplicateVerifier.selector
        );

        new TrueSignGuard(
            address(safe),
            verifiers,
            address(payeeRegistry)
        );
    }

    function testConstructorRejectsZeroPayeeRegistry() public {
        address[3] memory verifiers = [
            verifier1,
            verifier2,
            verifier3
        ];

        vm.expectRevert(
            TrueSignGuard.InvalidPayeeRegistry.selector
        );

        new TrueSignGuard(
            address(safe),
            verifiers,
            address(0)
        );
    }

    // --------------------------------------------------
    // QUORUM TESTS
    // --------------------------------------------------

    function testValidTwoOfThreeQuorum() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        _submitValidAttestation(txHash, expiry);

        assertEq(
            guard.approvedExpiry(txHash),
            expiry
        );
    }

    function testRejectsSingleSignature() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        bytes32 digest = guard.getAttestationDigest(
            txHash,
            expiry
        );

        (, bytes memory signature) = _sign(
            KEY_1,
            digest
        );

        bytes[] memory signatures = new bytes[](1);
        signatures[0] = signature;

        vm.expectRevert(
            TrueSignGuard.InvalidSignatureCount.selector
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    function testRejectsDuplicateSignatures() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        bytes32 digest = guard.getAttestationDigest(
            txHash,
            expiry
        );

        (, bytes memory signature) = _sign(
            KEY_1,
            digest
        );

        bytes[] memory signatures = new bytes[](2);
        signatures[0] = signature;
        signatures[1] = signature;

        vm.expectRevert(
            TrueSignGuard.InvalidSignatureOrder.selector
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    function testRejectsUnauthorizedVerifier() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        bytes32 digest = guard.getAttestationDigest(
            txHash,
            expiry
        );

        bytes[] memory signatures = _twoSignatures(
            digest,
            KEY_1,
            UNAUTHORIZED_KEY
        );

        vm.expectRevert(
            TrueSignGuard.InvalidVerifier.selector
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    // --------------------------------------------------
    // EXPIRY TESTS
    // --------------------------------------------------

    function testRejectsAlreadyExpiredAttestation() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp - 1;

        bytes[] memory signatures = new bytes[](2);

        vm.expectRevert(
            TrueSignGuard.InvalidExpiry.selector
        );

        guard.submitAttestation(
            txHash,
            expiry,
            signatures
        );
    }

    function testRejectsAttestationAfterExpiry() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 100;

        _submitValidAttestation(txHash, expiry);

        vm.warp(expiry + 1);

        vm.expectRevert(
            TrueSignGuard.AttestationExpired.selector
        );

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );
    }

    // NEW TEST: EXACT EXPIRY TIME
    function testRejectsAttestationAtExactExpiry() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 100;

        _submitValidAttestation(txHash, expiry);

        vm.warp(expiry);

        vm.expectRevert(
            TrueSignGuard.AttestationExpired.selector
        );

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );
    }

    // --------------------------------------------------
    // TRANSACTION PROTECTION TESTS
    // --------------------------------------------------

    function testRejectsDelegateCall() public {
        vm.expectRevert(
            TrueSignGuard.DelegateCallNotAllowed.selector
        );

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.DelegateCall
        );
    }

    function testRejectsTransactionWithoutApproval() public {
        vm.expectRevert(
            TrueSignGuard.AttestationNotFound.selector
        );

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );
    }

    function testApprovedTransactionIsConsumed() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        _submitValidAttestation(txHash, expiry);

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );

        assertTrue(guard.consumed(txHash));
        assertEq(guard.approvedExpiry(txHash), 0);
    }

    function testCannotReuseConsumedAttestation() public {
        bytes32 txHash = _transactionHash();
        uint256 expiry = block.timestamp + 30 minutes;

        _submitValidAttestation(txHash, expiry);

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );

        vm.expectRevert(
            TrueSignGuard.AttestationNotFound.selector
        );

        safe.invokeGuard(
            guard,
            recipient,
            0,
            "",
            Enum.Operation.Call
        );
    }
}
