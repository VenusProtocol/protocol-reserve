// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test double for the Venus VAI token. Mirrors the real token's `burn(address,uint256)`
///         semantics: a third party may burn from `usr` only up to the allowance `usr` granted it,
///         and the allowance is decremented on burn (as it is on transferFrom).
contract MockVAI is ERC20 {
    constructor() ERC20("VAI Stablecoin", "VAI") {}

    function mint(address usr, uint256 wad) external {
        _mint(usr, wad);
    }

    function burn(address usr, uint256 wad) external {
        if (usr != msg.sender) {
            _spendAllowance(usr, msg.sender, wad);
        }
        _burn(usr, wad);
    }
}
