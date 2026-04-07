// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMonadPayEscrow {
    event Deposited(address payer, uint256 amount);
    event Released(address merchant, uint256 amount);
    event Refunded(address payer, uint256 amount);

    function deposit() external payable;

    function release() external;

    function refund() external;
}
