
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayeeRegistry} from "../src/PayeeRegistry.sol";

contract PayeeRegistryTest is Test {
    PayeeRegistry registry;

    address account = address(0x1111);
    address payee = address(0x2222);
    address attacker = address(0x3333);

    uint256 constant COOLDOWN = 1 days;

    function setUp() public {
        registry = new PayeeRegistry(COOLDOWN);
    }

    function testRegisterPayee() public {
        vm.prank(account);
        registry.registerPayee(payee);

        assertTrue(registry.isPayeeRegistered(account, payee));
        assertFalse(registry.isPayeeActive(account, payee));
    }

    function testPayeeBecomesActiveAfterCooldown() public {
        vm.prank(account);
        registry.registerPayee(payee);

        vm.warp(block.timestamp + COOLDOWN);

        assertTrue(registry.isPayeeActive(account, payee));
    }

    function testAccountCanRemovePayee() public {
        vm.prank(account);
        registry.registerPayee(payee);

        vm.prank(account);
        registry.removePayee(payee);

        assertFalse(registry.isPayeeRegistered(account, payee));
    }

    function testAttackerCannotRegisterForVictim() public {
        vm.prank(attacker);
        registry.registerPayee(payee);

        assertFalse(registry.isPayeeRegistered(account, payee));
        assertTrue(registry.isPayeeRegistered(attacker, payee));
    }

    function testCannotRegisterZeroAddress() public {
        vm.prank(account);

        vm.expectRevert(PayeeRegistry.InvalidPayee.selector);
        registry.registerPayee(address(0));
    }

    function testCannotRegisterSelf() public {
        vm.prank(account);

        vm.expectRevert(PayeeRegistry.InvalidPayee.selector);
        registry.registerPayee(account);
    }
}
