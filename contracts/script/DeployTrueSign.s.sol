// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Safe} from "safe-contracts/contracts/Safe.sol";
import {SafeProxy} from "safe-contracts/contracts/proxies/SafeProxy.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {Enum} from "safe-contracts/contracts/libraries/Enum.sol";

import {PayeeRegistry} from "../src/PayeeRegistry.sol";
import {TrueSignGuard} from "../src/TrueSignGuard.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract DeployTrueSign is Script {
    // Anvil account 0: deployer
    uint256 constant DEPLOYER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Anvil accounts 1 and 2: Safe owners
    uint256 constant OWNER_KEY_1 = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    uint256 constant OWNER_KEY_2 = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    // Anvil accounts 3, 4 and 5: Verifiers
    uint256 constant VERIFIER_KEY_1 = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

    uint256 constant VERIFIER_KEY_2 = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;

    uint256 constant VERIFIER_KEY_3 = 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba;

    function run() external {
        vm.startBroadcast(DEPLOYER_KEY);

        // 1. Deploy PayeeRegistry
        PayeeRegistry payeeRegistry = new PayeeRegistry(24 hours);

        // 2. Deploy Safe singleton
        Safe singleton = new Safe();

        // 3. Deploy Safe proxy factory
        SafeProxyFactory factory = new SafeProxyFactory();

        // 4. Prepare Safe owners
        address owner1 = vm.addr(OWNER_KEY_1);
        address owner2 = vm.addr(OWNER_KEY_2);

        address[] memory owners = new address[](2);

        // Safe requires owners in ascending address order.
        if (owner1 < owner2) {
            owners[0] = owner1;
            owners[1] = owner2;
        } else {
            owners[0] = owner2;
            owners[1] = owner1;
        }

        // 5. Initialize and deploy Safe proxy
        bytes memory initializer = abi.encodeCall(
            Safe.setup,
            (owners, uint256(2), address(0), bytes(""), address(0), address(0), uint256(0), payable(address(0)))
        );

        SafeProxy proxy = factory.createProxyWithNonce(address(singleton), initializer, 1);

        Safe safe = Safe(payable(address(proxy)));

        // 6. Prepare three verifier addresses
        address[3] memory verifiers = [vm.addr(VERIFIER_KEY_1), vm.addr(VERIFIER_KEY_2), vm.addr(VERIFIER_KEY_3)];

        // 7. Deploy TrueSignGuard
        TrueSignGuard guard = new TrueSignGuard(address(safe), verifiers, address(payeeRegistry));

        // 8. Install TrueSignGuard through a genuine Safe transaction
        bytes memory guardData = abi.encodeWithSignature("setGuard(address)", address(guard));

        bytes32 safeTxHash = safe.getTransactionHash(
            address(safe), 0, guardData, Enum.Operation.Call, 0, 0, 0, address(0), payable(address(0)), safe.nonce()
        );

        bytes memory ownerSignatures = _ownerSignatures(safeTxHash);

        bool success = safe.execTransaction(
            address(safe), 0, guardData, Enum.Operation.Call, 0, 0, 0, address(0), payable(address(0)), ownerSignatures
        );

        require(success, "TrueSignGuard installation failed");

        // 9. Deploy MockERC20
        MockERC20 token = new MockERC20("TrueSign USD Coin", "tUSDC", 6);

        vm.stopBroadcast();

        // 10. Print deployment addresses
        console2.log("================================");
        console2.log("       TRUESIGN DEPLOYMENT      ");
        console2.log("================================");

        console2.log("PayeeRegistry:", address(payeeRegistry));
        console2.log("Safe Singleton:", address(singleton));
        console2.log("Safe Proxy Factory:", address(factory));
        console2.log("Safe Proxy:", address(safe));
        console2.log("TrueSignGuard:", address(guard));
        console2.log("MockERC20:", address(token));

        console2.log("Safe Owner 1:", owner1);
        console2.log("Safe Owner 2:", owner2);

        console2.log("Verifier 1:", verifiers[0]);
        console2.log("Verifier 2:", verifiers[1]);
        console2.log("Verifier 3:", verifiers[2]);

        console2.log("Chain ID:", block.chainid);
        console2.log("================================");
    }

    function _ownerSignatures(bytes32 txHash) internal returns (bytes memory signatures) {
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(OWNER_KEY_1, txHash);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(OWNER_KEY_2, txHash);

        address owner1 = vm.addr(OWNER_KEY_1);
        address owner2 = vm.addr(OWNER_KEY_2);

        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);

        // Safe requires signatures in ascending owner-address order.
        if (owner1 < owner2) {
            signatures = bytes.concat(signature1, signature2);
        } else {
            signatures = bytes.concat(signature2, signature1);
        }
    }
}
