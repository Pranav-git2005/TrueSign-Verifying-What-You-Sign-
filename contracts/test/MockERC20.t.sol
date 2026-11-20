
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 token;

    address alice = address(0x1111);
    address bob = address(0x2222);
    address spender = address(0x3333);

    function setUp() public {
        token = new MockERC20("Mock USD Coin", "mUSDC", 6);
    }

    function testMintTokens() public {
        token.mint(alice, 1000e6);

        assertEq(token.balanceOf(alice), 1000e6);
        assertEq(token.totalSupply(), 1000e6);
    }

    function testTransferTokens() public {
        token.mint(alice, 1000e6);

        vm.prank(alice);
        token.transfer(bob, 250e6);

        assertEq(token.balanceOf(alice), 750e6);
        assertEq(token.balanceOf(bob), 250e6);
    }

    function testApproveTokens() public {
        vm.prank(alice);
        token.approve(spender, 500e6);

        assertEq(token.allowance(alice, spender), 500e6);
    }

    function testTransferFrom() public {
        token.mint(alice, 1000e6);

        vm.prank(alice);
        token.approve(spender, 400e6);

        vm.prank(spender);
        token.transferFrom(alice, bob, 300e6);

        assertEq(token.balanceOf(alice), 700e6);
        assertEq(token.balanceOf(bob), 300e6);
        assertEq(token.allowance(alice, spender), 100e6);
    }

    function testCannotTransferWithoutBalance() public {
        vm.prank(alice);

        vm.expectRevert("Insufficient balance");
        token.transfer(bob, 100e6);
    }
}
