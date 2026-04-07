// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMonadPayRouter {
    event PaymentReceived(
        bytes32 indexed reference,
        address indexed payer,
        address indexed merchant,
        address token,
        uint256 amount,
        string memo
    );

    function payWithToken(
        bytes32 reference,
        address merchant,
        address token,
        uint256 amount,
        string calldata memo
    ) external;

    function payWithNative(
        bytes32 reference,
        address merchant,
        string calldata memo
    ) external payable;
}
