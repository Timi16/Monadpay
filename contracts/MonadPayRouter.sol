// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMonadPayRouter} from "./interfaces/IMonadPayRouter.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract MonadPayRouter is IMonadPayRouter, ReentrancyGuard {
    error InvalidReference();
    error InvalidMerchant();
    error InvalidAmount();
    error TokenTransferFailed();
    error NativeTransferFailed();

    function payWithToken(
        bytes32 paymentReference,
        address merchant,
        address token,
        uint256 amount,
        string calldata memo
    ) external nonReentrant {
        _validate(paymentReference, merchant, amount);

        if (!IERC20(token).transferFrom(msg.sender, merchant, amount)) {
            revert TokenTransferFailed();
        }

        emit PaymentReceived(paymentReference, msg.sender, merchant, token, amount, memo);
    }

    function payWithNative(
        bytes32 paymentReference,
        address merchant,
        string calldata memo
    ) external payable nonReentrant {
        _validate(paymentReference, merchant, msg.value);

        (bool success,) = merchant.call{value: msg.value}("");
        if (!success) {
            revert NativeTransferFailed();
        }

        emit PaymentReceived(paymentReference, msg.sender, merchant, address(0), msg.value, memo);
    }

    function _validate(bytes32 paymentReference, address merchant, uint256 amount) internal pure {
        if (paymentReference == bytes32(0)) {
            revert InvalidReference();
        }
        if (merchant == address(0)) {
            revert InvalidMerchant();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
    }
}
