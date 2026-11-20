
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract PayeeRegistry {
    uint256 public immutable cooldownPeriod;

    mapping(address => mapping(address => uint256)) public registeredAt;

    event PayeeRegistered(
        address indexed account,
        address indexed payee,
        uint256 registeredTimestamp,
        uint256 activationTimestamp
    );

    event PayeeRemoved(address indexed account, address indexed payee);

    error InvalidPayee();
    error PayeeAlreadyRegistered();
    error PayeeNotRegistered();
    error InvalidCooldown();

    constructor(uint256 _cooldownPeriod) {
        if (_cooldownPeriod == 0) revert InvalidCooldown();
        cooldownPeriod = _cooldownPeriod;
    }

    function registerPayee(address payee) external {
        if (payee == address(0) || payee == msg.sender) {
            revert InvalidPayee();
        }

        if (registeredAt[msg.sender][payee] != 0) {
            revert PayeeAlreadyRegistered();
        }

        registeredAt[msg.sender][payee] = block.timestamp;

        emit PayeeRegistered(
            msg.sender,
            payee,
            block.timestamp,
            block.timestamp + cooldownPeriod
        );
    }

    function removePayee(address payee) external {
        if (registeredAt[msg.sender][payee] == 0) {
            revert PayeeNotRegistered();
        }

        delete registeredAt[msg.sender][payee];
        emit PayeeRemoved(msg.sender, payee);
    }

    function isPayeeRegistered(
        address account,
        address payee
    ) external view returns (bool) {
        return registeredAt[account][payee] != 0;
    }

    function isPayeeActive(
        address account,
        address payee
    ) external view returns (bool) {
        uint256 registeredTime = registeredAt[account][payee];

        if (registeredTime == 0) return false;

        return block.timestamp >= registeredTime + cooldownPeriod;
    }

    function activationTimestamp(
        address account,
        address payee
    ) external view returns (uint256) {
        uint256 registeredTime = registeredAt[account][payee];

        if (registeredTime == 0) return 0;

        return registeredTime + cooldownPeriod;
    }
}
