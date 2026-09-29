// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ResilientOracle } from "@venusprotocol/oracle/contracts/ResilientOracle.sol";
import { MockSimpleOracle } from "@venusprotocol/oracle/contracts/test/MockSimpleOracle.sol";
import { Test } from "forge-std/Test.sol";

import { MockACM } from "../../contracts/Test/Mocks/MockACM.sol";
import { MockToken } from "../../contracts/Test/Mocks/MockToken.sol";
import { IAbstractTokenConverter } from "../../contracts/TokenConverter/IAbstractTokenConverter.sol";
import { SingleTokenConverter } from "../../contracts/TokenConverter/SingleTokenConverter.sol";

/// @notice The converter sells tokenOut from its own balance for the base asset, at the oracle
///  price plus an incentive paid to the user. The quotes must never let a user take more than that.
contract SingleTokenConverterTest is Test {
    SingleTokenConverter internal converter;
    MockSimpleOracle internal oracle;
    MockToken internal baseAsset;
    MockToken internal tokenOut;

    /// @dev Keeps amount * price * 1e18, which the converter computes, clear of overflow.
    uint256 internal constant MAX_AMOUNT = 1e27;
    uint256 internal constant MAX_PRICE = 1e30;

    function setUp() public {
        MockACM acm = new MockACM();
        oracle = new MockSimpleOracle();
        baseAsset = new MockToken("Base", "BASE", 18);
        tokenOut = new MockToken("Out", "OUT", 18);

        SingleTokenConverter implementation = new SingleTokenConverter();
        bytes memory initialize = abi.encodeCall(
            SingleTokenConverter.initialize,
            (address(acm), ResilientOracle(address(oracle)), makeAddr("destination"), address(baseAsset), 1)
        );
        converter = SingleTokenConverter(address(new ERC1967Proxy(address(implementation), initialize)));

        acm.giveCallPermission(
            address(converter),
            "setConversionConfig(address,address,ConversionConfig)",
            address(this)
        );
    }

    /// @notice What the user pays, grossed up by the incentive, covers what they receive. The quote
    ///  rounds amountIn up for exactly this reason.
    function testFuzz_quotedAmountInCoversTheValueOut(
        uint256 amountOut,
        uint256 priceIn,
        uint256 priceOut,
        uint256 incentive
    ) public {
        amountOut = bound(amountOut, 1, MAX_AMOUNT);
        (priceIn, priceOut, incentive) = _configure(priceIn, priceOut, incentive);
        deal(address(tokenOut), address(converter), amountOut);

        (, uint256 amountIn) = converter.getAmountIn(amountOut, address(baseAsset), address(tokenOut));

        assertGe(amountIn * priceIn * (1e18 + incentive), amountOut * priceOut * 1e18);
    }

    /// @notice When the converter holds less tokenOut than the input would buy, the quote shrinks to
    ///  the reserve and must never ask for more input than the user offered.
    function testFuzz_cappedQuoteStaysWithinTheReserveAndTheInput(
        uint256 amountIn,
        uint256 reserve,
        uint256 priceIn,
        uint256 priceOut,
        uint256 incentive
    ) public {
        amountIn = bound(amountIn, 1, MAX_AMOUNT);
        reserve = bound(reserve, 0, MAX_AMOUNT);
        _configure(priceIn, priceOut, incentive);
        deal(address(tokenOut), address(converter), reserve);

        (uint256 amountConverted, uint256 amountOut) = converter.getAmountOut(
            amountIn,
            address(baseAsset),
            address(tokenOut)
        );

        assertLe(amountOut, reserve);
        assertLe(amountConverted, amountIn);
    }

    function _configure(
        uint256 priceIn,
        uint256 priceOut,
        uint256 incentive
    )
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        priceIn = bound(priceIn, 1, MAX_PRICE);
        priceOut = bound(priceOut, 1, MAX_PRICE);
        incentive = bound(incentive, 0, converter.MAX_INCENTIVE());

        oracle.setPrice(address(baseAsset), priceIn);
        oracle.setPrice(address(tokenOut), priceOut);
        converter.setConversionConfig(
            address(baseAsset),
            address(tokenOut),
            IAbstractTokenConverter.ConversionConfig({
                incentive: incentive,
                conversionAccess: IAbstractTokenConverter.ConversionAccessibility.ONLY_FOR_USERS
            })
        );
        return (priceIn, priceOut, incentive);
    }
}
