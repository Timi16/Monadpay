// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MonadPayEscrow} from "../contracts/MonadPayEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MonadPayEscrowTest is Test {
    MockERC20 internal token;

    address internal payer = makeAddr("payer");
    address internal merchant = makeAddr("merchant");
    bytes32 internal paymentReference = keccak256("escrow-reference");
    uint256 internal constant AMOUNT = 50 ether;

    function setUp() public {
        token = new MockERC20();
    }

    function test_deposit_erc20_happyPath() public {
        MonadPayEscrow escrow = _deployTokenEscrow(block.timestamp + 1 days);
        token.mint(payer, AMOUNT);

        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        escrow.deposit();
        vm.stopPrank();

        (bool deposited, bool released, address storedPayer, uint256 expiry) = escrow.getStatus();

        assertTrue(deposited);
        assertFalse(released);
        assertEq(storedPayer, payer);
        assertEq(expiry, block.timestamp + 1 days);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
    }

    function test_deposit_native_happyPath() public {
        MonadPayEscrow escrow = _deployNativeEscrow(block.timestamp + 1 days);
        vm.deal(payer, AMOUNT);

        vm.prank(payer);
        escrow.deposit{value: AMOUNT}();

        assertEq(address(escrow).balance, AMOUNT);
        assertEq(escrow.payer(), payer);
        assertTrue(escrow.deposited());
    }

    function test_release_byMerchant() public {
        MonadPayEscrow escrow = _deployTokenEscrow(block.timestamp + 1 days);
        token.mint(payer, AMOUNT);

        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        escrow.deposit();
        vm.stopPrank();

        vm.prank(merchant);
        escrow.release();

        assertEq(token.balanceOf(merchant), AMOUNT);
        assertTrue(escrow.released());
    }

    function test_release_notMerchant_reverts() public {
        MonadPayEscrow escrow = _deployTokenEscrow(block.timestamp + 1 days);

        vm.expectRevert(MonadPayEscrow.NotMerchant.selector);
        vm.prank(payer);
        escrow.release();
    }

    function test_refund_afterExpiry() public {
        MonadPayEscrow escrow = _deployNativeEscrow(block.timestamp + 1 days);
        vm.deal(payer, AMOUNT);

        vm.prank(payer);
        escrow.deposit{value: AMOUNT}();

        vm.warp(block.timestamp + 1 days + 1);

        uint256 balanceBefore = payer.balance;
        vm.prank(payer);
        escrow.refund();

        assertEq(payer.balance, balanceBefore + AMOUNT);
    }

    function test_refund_beforeExpiry_reverts() public {
        MonadPayEscrow escrow = _deployNativeEscrow(block.timestamp + 1 days);
        vm.deal(payer, AMOUNT);

        vm.prank(payer);
        escrow.deposit{value: AMOUNT}();

        vm.expectRevert(MonadPayEscrow.EscrowNotExpired.selector);
        vm.prank(payer);
        escrow.refund();
    }

    function test_doubleRelease_reverts() public {
        MonadPayEscrow escrow = _deployTokenEscrow(block.timestamp + 1 days);
        token.mint(payer, AMOUNT);

        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        escrow.deposit();
        vm.stopPrank();

        vm.prank(merchant);
        escrow.release();

        vm.expectRevert(MonadPayEscrow.AlreadyReleased.selector);
        vm.prank(merchant);
        escrow.release();
    }

    function test_doubleDeposit_reverts() public {
        MonadPayEscrow escrow = _deployTokenEscrow(block.timestamp + 1 days);
        token.mint(payer, AMOUNT * 2);

        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT * 2);
        escrow.deposit();

        vm.expectRevert(MonadPayEscrow.AlreadyDeposited.selector);
        escrow.deposit();
        vm.stopPrank();
    }

    function testFuzz_expiry(uint256 warpTime) public {
        warpTime = bound(warpTime, 0, 2 days);

        MonadPayEscrow releaseEscrow = _deployNativeEscrow(block.timestamp + 1 days);
        MonadPayEscrow refundEscrow = _deployNativeEscrow(block.timestamp + 1 days);

        vm.deal(payer, AMOUNT * 2);

        vm.startPrank(payer);
        releaseEscrow.deposit{value: AMOUNT}();
        refundEscrow.deposit{value: AMOUNT}();
        vm.stopPrank();

        vm.warp(block.timestamp + warpTime);

        if (block.timestamp <= releaseEscrow.expiry()) {
            vm.prank(merchant);
            releaseEscrow.release();

            vm.expectRevert(MonadPayEscrow.EscrowNotExpired.selector);
            vm.prank(payer);
            refundEscrow.refund();
        } else {
            vm.expectRevert(MonadPayEscrow.EscrowExpired.selector);
            vm.prank(merchant);
            releaseEscrow.release();

            vm.prank(payer);
            refundEscrow.refund();
        }
    }

    function _deployTokenEscrow(uint256 expiry) internal returns (MonadPayEscrow) {
        return new MonadPayEscrow(paymentReference, merchant, address(token), AMOUNT, expiry);
    }

    function _deployNativeEscrow(uint256 expiry) internal returns (MonadPayEscrow) {
        return new MonadPayEscrow(paymentReference, merchant, address(0), AMOUNT, expiry);
    }
}
