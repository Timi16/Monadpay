// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMonadPayRouter {
    event PaymentReceived(
        bytes32 indexed paymentReference,
        address indexed payer,
        address indexed merchant,
        address token,
        uint256 amount,
        string memo
    );

    function payWithToken(
        bytes32 paymentReference,
        address merchant,
        address token,
        uint256 amount,
        string calldata memo
    ) external;

    function payWithNative(
        bytes32 paymentReference,
        address merchant,
        string calldata memo
    ) external payable;
}
