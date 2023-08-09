## [1.0.0-dev.3](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.2...v1.0.0-dev.3) (2023-08-09)


### Bug Fixes

* remove unused event ([12d87b2](https://github.com/VenusProtocol/protocol-reserve/commit/12d87b2be9ad750345e6163cb79e2902f328de74))

## [1.0.0-dev.2](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.1...v1.0.0-dev.2) (2023-08-08)


### Features

* remove unneeded dependencies ([3d81f0b](https://github.com/VenusProtocol/protocol-reserve/commit/3d81f0b92528eea0d322cce6e13d6f94e2cc5bfc))

## 1.0.0-dev.1 (2023-08-08)


### Features

* accrue prime interest and getUnreleasedFunds ([0f44155](https://github.com/VenusProtocol/protocol-reserve/commit/0f441552a35f41fc110e6e3fe4455385dfd25fa6))
* added prime interface ([c035bbe](https://github.com/VenusProtocol/protocol-reserve/commit/c035bbe0653115a9f5ca3693675fee16b44e1858))
* configuration tests ([386b2d5](https://github.com/VenusProtocol/protocol-reserve/commit/386b2d54ebf3834766292313af7577ec617d5af2))
* destination addresses and distribution percent ([28de15b](https://github.com/VenusProtocol/protocol-reserve/commit/28de15b390c958ef529f6a10dd7640d58b7795db))
* distribute assets to configured targets ([bd18801](https://github.com/VenusProtocol/protocol-reserve/commit/bd1880190c74c55faff15a5f9aca38da15b6c2dc))
* dynamic destinations and split funds based of comptroller ([bc8f342](https://github.com/VenusProtocol/protocol-reserve/commit/bc8f342ecf14294e7dbfbf13014db44707cd71aa))
* integrate acm ([4341f0f](https://github.com/VenusProtocol/protocol-reserve/commit/4341f0fff8254efb41351f798abba3344a3c5f61))
* store reserve balance based on schema ([1a452e0](https://github.com/VenusProtocol/protocol-reserve/commit/1a452e005cec558d47a7a9a04df75fcb33b2eb30))
* tests for collecting assets income ([6275765](https://github.com/VenusProtocol/protocol-reserve/commit/62757657ec81a5c955bee5713a40f60bcf6ee8b0))
* tests for income collection and distribution ([50e7f9b](https://github.com/VenusProtocol/protocol-reserve/commit/50e7f9b0c1455e3c9ba3e2395c5d24cec79b5163))
* track reserves based on income type ([be4ceac](https://github.com/VenusProtocol/protocol-reserve/commit/be4ceace6cc2c052a4717319ca28cda1bd13ec1c))


### Bug Fixes

* ability to set multiple configs and percent should be 100 ([2787ba5](https://github.com/VenusProtocol/protocol-reserve/commit/2787ba520371746f703791e29ad2c85fa9157c1e))
* add func to get total targets ([824b9e4](https://github.com/VenusProtocol/protocol-reserve/commit/824b9e4c0d48d13b675014d595301177a60bd340))
* added events for distribution config ([47b9267](https://github.com/VenusProtocol/protocol-reserve/commit/47b9267959e70bfcdcb9689b9f774891fc12880e))
* break loop to optimise gas ([86ec492](https://github.com/VenusProtocol/protocol-reserve/commit/86ec492fa78eae192aaea521564f390b0b90e802))
* bump hardhat version ([a16d980](https://github.com/VenusProtocol/protocol-reserve/commit/a16d9801da15072b49cf6e70628afd1365ba6fa4))
* change i++ to ++i ([f6f9aa0](https://github.com/VenusProtocol/protocol-reserve/commit/f6f9aa025073e83806554fbbabd51630b78e3dfb))
* change storage to memory ([874fe90](https://github.com/VenusProtocol/protocol-reserve/commit/874fe902fb7dc7655bce3bc901f4b6a4294ea3e6))
* create seperate func to get schema type ([9e44047](https://github.com/VenusProtocol/protocol-reserve/commit/9e44047b7fd2cc22d387c7091f2c5fc5d68ac8f4))
* fix folder names ([b801a93](https://github.com/VenusProtocol/protocol-reserve/commit/b801a93ba7682d94e9708682dc531915cdcc6b67))
* fix function name ([f80db3b](https://github.com/VenusProtocol/protocol-reserve/commit/f80db3be5b5a7810f393566b23283205bfc45f13))
* fix named imports ([6d7e326](https://github.com/VenusProtocol/protocol-reserve/commit/6d7e3260b7d5e474262e2c28d09f7eadc9e7e33a))
* fix tests ([becfa34](https://github.com/VenusProtocol/protocol-reserve/commit/becfa34bb134fef08acfd4da82c5fe53216e34aa))
* fixed lint and schema order ([5d2b7a7](https://github.com/VenusProtocol/protocol-reserve/commit/5d2b7a7c4e3d76a5365ff9738902964ce2d43dad))
* fixed syntax ([7217c9f](https://github.com/VenusProtocol/protocol-reserve/commit/7217c9f8137ae37e5a95c52f1cf75eeea9bbd28a))
* fixed total balance calculation and tests ([f149fab](https://github.com/VenusProtocol/protocol-reserve/commit/f149fab865059e3b1371d1fdcbc09c4b0050e6bb))
* function to ensure percentage check ([46a1c3a](https://github.com/VenusProtocol/protocol-reserve/commit/46a1c3a758fce9e3abce2cb657dd6b65f617f78b))
* handle vbnb market ([332fb34](https://github.com/VenusProtocol/protocol-reserve/commit/332fb34ef09494f6d6068e63078631bd667a7892))
* make core pool comptroller immutable ([f5d7185](https://github.com/VenusProtocol/protocol-reserve/commit/f5d7185632d97ab1d16e7b77fc130feefd0d30c0))
* make totalAssetReserve as public ([187d70c](https://github.com/VenusProtocol/protocol-reserve/commit/187d70c941778cd8e924abb8f2903b19a2c1d68b))
* make vBNB public ([d6a0a83](https://github.com/VenusProtocol/protocol-reserve/commit/d6a0a83e3313b5ee0c215099677c9e328d561b30))
* make WBNB public ([eea9206](https://github.com/VenusProtocol/protocol-reserve/commit/eea920619f5f69a282d5975b8d34a5492bb7bbdd))
* mark funcs as view ([e1385e1](https://github.com/VenusProtocol/protocol-reserve/commit/e1385e1420653566dc75415a603dac2c8de6af11))
* only accrue interest in prime during release funds ([bc97d7d](https://github.com/VenusProtocol/protocol-reserve/commit/bc97d7db7693ca272ab0c4d0c3ed4fc065f919ec))
* optimise gas by storing length of targets in temp var ([048f348](https://github.com/VenusProtocol/protocol-reserve/commit/048f34889170ae03da1d574b38a7d34a2b1750c6))
* optimise loop ([0c17b63](https://github.com/VenusProtocol/protocol-reserve/commit/0c17b63dcda6f54b9c508a00156f48607ab03011))
* optimise loop ([4e28a44](https://github.com/VenusProtocol/protocol-reserve/commit/4e28a446fc3e1fcca95bf5619c55409f3c1be6aa))
* release and accrue prime interest duing release ([c9c7c44](https://github.com/VenusProtocol/protocol-reserve/commit/c9c7c44d5398b0ed9dd65562349f602f3fd2798b))
* release funds dynamically based on schemas ([d1c6b7d](https://github.com/VenusProtocol/protocol-reserve/commit/d1c6b7d52e40a380dd7e1804354e8d55b9b941f8))
* remove console.log ([d8e8551](https://github.com/VenusProtocol/protocol-reserve/commit/d8e855167ff1223f3ad4beecbe773cc8780bb1ae))
* remove extra parameter for releaseFund ([dbef07d](https://github.com/VenusProtocol/protocol-reserve/commit/dbef07dfb3d537a27a1810cd3bc2c89c0a43d6fd))
* remove pool registry dependency for deployment ([f8039fc](https://github.com/VenusProtocol/protocol-reserve/commit/f8039fca475ae605a2dabd855c2a744d407d1d75))
* remove undefined income type ([8521ad1](https://github.com/VenusProtocol/protocol-reserve/commit/8521ad19f0826b8b12b51ecd28c39a4f2a1dfb2d))
* remove unwanted contracts and interfaces ([2074ce0](https://github.com/VenusProtocol/protocol-reserve/commit/2074ce06aefcbad17de03b03dbb51b5c65cabefc))
* removed unused events and methods ([535933b](https://github.com/VenusProtocol/protocol-reserve/commit/535933b122e88aee133b9df8f9cbf30a432d3a39))
* renamed schemas ([f0d6c4d](https://github.com/VenusProtocol/protocol-reserve/commit/f0d6c4deca3cf599989154ad97c9a8679d39a2c4))
* replace isPrime with vTokenForAsset ([6814574](https://github.com/VenusProtocol/protocol-reserve/commit/681457488bbc3f2aae92df200324f20183ab1c50))
* resolved conflict ([29e62de](https://github.com/VenusProtocol/protocol-reserve/commit/29e62de80e88afb093b19c95db1291963294d62f))
* save gas if nothing to release ([978b6ec](https://github.com/VenusProtocol/protocol-reserve/commit/978b6ecc5f7dad265dbb4563268b53205b05880b))
* simplify require statement ([294ca74](https://github.com/VenusProtocol/protocol-reserve/commit/294ca74a5da947bdfa2825443ab29d76ece84b0d))
* use custom errors ([5af3b3c](https://github.com/VenusProtocol/protocol-reserve/commit/5af3b3c360dd1a4825d5285cfcebea5aee51e9bf))
* use j for inner loop ([fe12bd5](https://github.com/VenusProtocol/protocol-reserve/commit/fe12bd56ed10262328fef0b6a0999db401a0860b))
* use node 18 ([ed4685a](https://github.com/VenusProtocol/protocol-reserve/commit/ed4685af84f29e3476288c2cd88e232d6d3c3e6c))
