// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MonadPayRouter} from "../contracts/MonadPayRouter.sol";

contract DeployRouter is Script {
    function run() external returns (MonadPayRouter router) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("MONAD_RPC_URL");

        require(bytes(rpcUrl).length != 0, "MONAD_RPC_URL missing");

        vm.startBroadcast(privateKey);
        router = new MonadPayRouter();
        vm.stopBroadcast();

        string memory json = string.concat(
            '{"router":"',
            vm.toString(address(router)),
            '","rpcUrl":"',
            rpcUrl,
            '"}'
        );

        vm.writeFile("deployments/router.json", json);
        console2.log("MonadPayRouter deployed at", address(router));
    }
}
