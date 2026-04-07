// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMonadPayEscrow} from "./interfaces/IMonadPayEscrow.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract MonadPayEscrow is IMonadPayEscrow, ReentrancyGuard {
    error InvalidMerchant();
    error InvalidAmount();
    error AlreadyDeposited();
    error AlreadyReleased();
    error NotMerchant();
    error NotPayer();
    error NotDeposited();
    error InvalidNativeAmount();
    error EscrowExpired();
    error EscrowNotExpired();
    error TransferFailed();

    bytes32 public immutable paymentReference;
    address public immutable merchant;
    address public immutable token;
    uint256 public immutable requiredAmount;
    uint256 public immutable expiry;

    bool public deposited;
    bool public released;
    address public payer;

    constructor(
        bytes32 paymentReference_,
        address merchant_,
        address token_,
        uint256 requiredAmount_,
        uint256 expiry_
    ) {
        if (merchant_ == address(0)) {
            revert InvalidMerchant();
        }
        if (requiredAmount_ == 0) {
            revert InvalidAmount();
        }

        paymentReference = paymentReference_;
        merchant = merchant_;
        token = token_;
        requiredAmount = requiredAmount_;
        expiry = expiry_;
    }

    function deposit() external payable nonReentrant {
        if (deposited) {
            revert AlreadyDeposited();
        }

        deposited = true;
        payer = msg.sender;

        if (token == address(0)) {
            if (msg.value != requiredAmount) {
                revert InvalidNativeAmount();
            }
        } else {
            if (msg.value != 0) {
                revert InvalidNativeAmount();
            }
            if (!IERC20(token).transferFrom(msg.sender, address(this), requiredAmount)) {
                revert TransferFailed();
            }
        }

        emit Deposited(msg.sender, requiredAmount);
    }

    function release() external nonReentrant {
        if (msg.sender != merchant) {
            revert NotMerchant();
        }
        if (!deposited) {
            revert NotDeposited();
        }
        if (released) {
            revert AlreadyReleased();
        }
        if (block.timestamp > expiry) {
            revert EscrowExpired();
        }

        released = true;
        _transferFunds(merchant, requiredAmount);

        emit Released(merchant, requiredAmount);
    }

    function refund() external nonReentrant {
        if (msg.sender != payer) {
            revert NotPayer();
        }
        if (!deposited) {
            revert NotDeposited();
        }
        if (released) {
            revert AlreadyReleased();
        }
        if (block.timestamp <= expiry) {
            revert EscrowNotExpired();
        }

        _transferFunds(payer, requiredAmount);

        emit Refunded(payer, requiredAmount);
    }

    function getStatus() external view returns (bool, bool, address, uint256) {
        return (deposited, released, payer, expiry);
    }

    function _transferFunds(address recipient, uint256 amount) internal {
        if (token == address(0)) {
            (bool success,) = recipient.call{value: amount}("");
            if (!success) {
                revert TransferFailed();
            }
            return;
        }

        if (!IERC20(token).transfer(recipient, amount)) {
            revert TransferFailed();
        }
    }
}
