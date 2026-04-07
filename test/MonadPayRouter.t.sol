// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MonadPayRouter} from "../contracts/MonadPayRouter.sol";
import {IMonadPayRouter} from "../contracts/interfaces/IMonadPayRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ReentrantMerchant {
    MonadPayRouter internal immutable router;
    bytes32 internal immutable nestedReference;

    constructor(MonadPayRouter router_, bytes32 nestedReference_) {
        router = router_;
        nestedReference = nestedReference_;
    }

    receive() external payable {
        router.payWithNative{value: 1}(nestedReference, address(this), "reenter");
    }
}

contract MonadPayRouterTest is Test {
    MonadPayRouter internal router;
    MockERC20 internal token;

    address internal payer = makeAddr("payer");
    address internal merchant = makeAddr("merchant");
    bytes32 internal paymentReference = keccak256("reference");

    function setUp() public {
        router = new MonadPayRouter();
        token = new MockERC20();
    }

    function test_payWithToken_happyPath() public {
        uint256 amount = 100 ether;

        token.mint(payer, amount);

        vm.startPrank(payer);
        token.approve(address(router), amount);

        vm.expectEmit(address(router));
        emit IMonadPayRouter.PaymentReceived(paymentReference, payer, merchant, address(token), amount, "memo");

        router.payWithToken(paymentReference, merchant, address(token), amount, "memo");
        vm.stopPrank();

        assertEq(token.balanceOf(merchant), amount);
        assertEq(token.balanceOf(payer), 0);
    }

    function test_payWithToken_zeroAmount() public {
        vm.expectRevert(MonadPayRouter.InvalidAmount.selector);
        vm.prank(payer);
        router.payWithToken(paymentReference, merchant, address(token), 0, "memo");
    }

    function test_payWithToken_zeroMerchant() public {
        vm.expectRevert(MonadPayRouter.InvalidMerchant.selector);
        vm.prank(payer);
        router.payWithToken(paymentReference, address(0), address(token), 1, "memo");
    }

    function test_payWithNative_happyPath() public {
        uint256 amount = 1 ether;

        vm.deal(payer, amount);

        vm.expectEmit(address(router));
        emit IMonadPayRouter.PaymentReceived(paymentReference, payer, merchant, address(0), amount, "memo");

        vm.prank(payer);
        router.payWithNative{value: amount}(paymentReference, merchant, "memo");

        assertEq(merchant.balance, amount);
    }

    function test_payWithNative_zeroValue() public {
        vm.expectRevert(MonadPayRouter.InvalidAmount.selector);
        vm.prank(payer);
        router.payWithNative(paymentReference, merchant, "memo");
    }

    function test_reentrancy_attack() public {
        ReentrantMerchant attacker = new ReentrantMerchant(router, keccak256("nested"));
        vm.deal(payer, 1 ether);

        vm.expectRevert(MonadPayRouter.NativeTransferFailed.selector);
        vm.prank(payer);
        router.payWithNative{value: 1 ether}(paymentReference, address(attacker), "attack");
    }

    function testFuzz_payWithToken(uint256 amount) public {
        amount = bound(amount, 1, 1e30);

        token.mint(payer, amount);

        vm.startPrank(payer);
        token.approve(address(router), amount);
        router.payWithToken(paymentReference, merchant, address(token), amount, "memo");
        vm.stopPrank();

        assertEq(token.balanceOf(merchant), amount);
        assertEq(token.balanceOf(payer), 0);
    }
}
