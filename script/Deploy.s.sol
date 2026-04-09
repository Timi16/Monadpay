// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MonadPayRouter} from "../contracts/MonadPayRouter.sol";

contract DeployRouter is Script {
    function run() external returns (MonadPayRouter router) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("MONAD_RPC_URL");
        string memory chainId = vm.toString(block.chainid);

        require(bytes(rpcUrl).length != 0, "MONAD_RPC_URL missing");

        vm.startBroadcast(privateKey);
        router = new MonadPayRouter();
        vm.stopBroadcast();

        vm.createDir("deployments", true);

        string memory json = string.concat(
            '{"router":"',
            vm.toString(address(router)),
            '","chainId":',
            chainId,
            ',"rpcUrl":"',
            rpcUrl,
            '"}'
        );

        vm.writeFile("deployments/router.json", json);
        vm.writeFile(string.concat("deployments/router.", chainId, ".json"), json);
        console2.log("MonadPayRouter deployed at", address(router));
    }
}
