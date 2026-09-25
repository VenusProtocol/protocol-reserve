// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";
import { Test } from "forge-std/Test.sol";

import { IComptroller } from "../../contracts/Interfaces/IComptroller.sol";
import { IPoolRegistry } from "../../contracts/Interfaces/IPoolRegistry.sol";
import { IProtocolShareReserve } from "../../contracts/Interfaces/IProtocolShareReserve.sol";
import { ProtocolShareReserve } from "../../contracts/ProtocolReserve/ProtocolShareReserve.sol";
import { MockACM } from "../../contracts/Test/Mocks/MockACM.sol";
import { MockToken } from "../../contracts/Test/Mocks/MockToken.sol";

uint256 constant MAX_INCOME = 1e30;

/// @dev Splits both schemas between two destinations: the given basis points to `first`, the rest
///  to `second`.
function twoWaySplit(
    address first,
    address second,
    uint256 reservesToFirst,
    uint256 revenueToFirst
) pure returns (ProtocolShareReserve.DistributionConfig[] memory configs) {
    ProtocolShareReserve.Schema reserves = ProtocolShareReserve.Schema.PROTOCOL_RESERVES;
    ProtocolShareReserve.Schema revenue = ProtocolShareReserve.Schema.ADDITIONAL_REVENUE;
    configs = new ProtocolShareReserve.DistributionConfig[](4);
    configs[0] = ProtocolShareReserve.DistributionConfig(reserves, uint16(reservesToFirst), first);
    configs[1] = ProtocolShareReserve.DistributionConfig(reserves, uint16(1e4 - reservesToFirst), second);
    configs[2] = ProtocolShareReserve.DistributionConfig(revenue, uint16(revenueToFirst), first);
    configs[3] = ProtocolShareReserve.DistributionConfig(revenue, uint16(1e4 - revenueToFirst), second);
}

/// @dev The reserve notifies each destination after paying it; this one only has to accept the call.
contract IncomeDestination {
    function updateAssetsState(address, address) external {}
}

contract ProtocolShareReserveHandler is CommonBase, StdCheats, StdUtils {
    ProtocolShareReserve public immutable psr;
    MockToken public immutable token;
    address[] public comptrollers;
    address[] public destinations;

    constructor(
        ProtocolShareReserve psr_,
        MockToken token_,
        address[] memory comptrollers_,
        address[] memory destinations_
    ) {
        psr = psr_;
        token = token_;
        comptrollers = comptrollers_;
        destinations = destinations_;
    }

    /// @dev A market sends income, then reports it, the way VToken and the Comptroller do.
    function receiveIncome(
        uint256 comptrollerSeed,
        uint256 incomeTypeSeed,
        uint256 amount
    ) external {
        amount = bound(amount, 1, MAX_INCOME);
        deal(address(token), address(psr), token.balanceOf(address(psr)) + amount);

        psr.updateAssetsState(
            comptrollers[comptrollerSeed % comptrollers.length],
            address(token),
            IProtocolShareReserve.IncomeType(bound(incomeTypeSeed, 0, 5))
        );
    }

    function releaseFunds(uint256 comptrollerSeed) external {
        address[] memory assets = new address[](1);
        assets[0] = address(token);
        psr.releaseFunds(comptrollers[comptrollerSeed % comptrollers.length], assets);
    }

    /// @dev Governance moving the split while income is waiting to be released.
    function redistribute(uint256 reservesToFirst, uint256 revenueToFirst) external {
        psr.addOrUpdateDistributionConfigs(
            twoWaySplit(destinations[0], destinations[1], bound(reservesToFirst, 0, 1e4), bound(revenueToFirst, 0, 1e4))
        );
    }
}

/// @notice Income is attributed to a pool and schema when it arrives, and paid out to the
///  configured destinations when released. The books must match the tokens throughout.
contract ProtocolShareReserveTest is Test {
    ProtocolShareReserve internal psr;
    ProtocolShareReserveHandler internal handler;
    MockToken internal token;

    address internal corePool = makeAddr("corePoolComptroller");
    address internal isolatedPool = makeAddr("isolatedPoolComptroller");
    address internal first = address(new IncomeDestination());
    address internal second = address(new IncomeDestination());

    function setUp() public {
        vm.mockCall(corePool, abi.encodeCall(IComptroller.isComptroller, ()), abi.encode(true));
        vm.mockCall(isolatedPool, abi.encodeCall(IComptroller.isComptroller, ()), abi.encode(true));
        // Income from anything but the core pool must come from a market the registry knows.
        address poolRegistry = makeAddr("poolRegistry");
        vm.mockCall(
            poolRegistry,
            abi.encodeWithSelector(IPoolRegistry.getVTokenForAsset.selector),
            abi.encode(makeAddr("vToken"))
        );

        MockACM acm = new MockACM();
        ProtocolShareReserve implementation = new ProtocolShareReserve(corePool, makeAddr("wbnb"), makeAddr("vbnb"));
        psr = ProtocolShareReserve(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(ProtocolShareReserve.initialize, (address(acm), 100))
                )
            )
        );
        psr.setPoolRegistry(poolRegistry);
        token = new MockToken("Income", "INC", 18);

        address[] memory comptrollers = new address[](2);
        comptrollers[0] = corePool;
        comptrollers[1] = isolatedPool;
        address[] memory destinations = new address[](2);
        destinations[0] = first;
        destinations[1] = second;
        handler = new ProtocolShareReserveHandler(psr, token, comptrollers, destinations);

        string memory configure = "addOrUpdateDistributionConfigs(DistributionConfig[])";
        acm.giveCallPermission(address(psr), configure, address(this));
        acm.giveCallPermission(address(psr), configure, address(handler));
        psr.addOrUpdateDistributionConfigs(twoWaySplit(first, second, 5000, 5000));

        targetContract(address(handler));
    }

    /// @notice A release pays out everything but rounding dust. Two destinations each round their
    ///  share down by less than one unit, so at most one unit stays behind.
    function testFuzz_releaseLeavesOnlyRoundingDust(
        uint256 amount,
        uint256 incomeTypeSeed,
        uint256 reservesToFirst,
        uint256 revenueToFirst
    ) public {
        amount = bound(amount, 1, MAX_INCOME);
        psr.addOrUpdateDistributionConfigs(
            twoWaySplit(first, second, bound(reservesToFirst, 0, 1e4), bound(revenueToFirst, 0, 1e4))
        );

        deal(address(token), address(psr), amount);
        psr.updateAssetsState(corePool, address(token), IProtocolShareReserve.IncomeType(bound(incomeTypeSeed, 0, 5)));

        address[] memory assets = new address[](1);
        assets[0] = address(token);
        psr.releaseFunds(corePool, assets);

        assertLe(token.balanceOf(address(psr)), 1);
        assertEq(psr.totalAssetReserve(address(token)), token.balanceOf(address(psr)));
    }

    /// @notice Every token the reserve holds is on its books and nothing on its books is missing.
    ///  The handler reports each payment as it arrives, so the two match exactly.
    function invariant_reservesMatchTheBalance() public view {
        assertEq(psr.totalAssetReserve(address(token)), token.balanceOf(address(psr)));
    }

    /// @notice The asset-wide total is exactly the sum of what each pool and schema is owed. A
    ///  release for one pool must never draw on another pool's share.
    function invariant_totalReserveIsTheSumOfEachPoolAndSchema() public view {
        uint256 sum;
        address[2] memory pools = [corePool, isolatedPool];
        for (uint256 i; i < pools.length; ++i) {
            sum += psr.assetsReserves(pools[i], address(token), ProtocolShareReserve.Schema.PROTOCOL_RESERVES);
            sum += psr.assetsReserves(pools[i], address(token), ProtocolShareReserve.Schema.ADDITIONAL_REVENUE);
        }
        assertEq(psr.totalAssetReserve(address(token)), sum);
    }
}
