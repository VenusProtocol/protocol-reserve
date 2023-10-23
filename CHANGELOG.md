## [1.0.1-dev.1](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0...v1.0.1-dev.1) (2023-10-23)


### Bug Fixes

* remove duplicate directory ([cd3c32e](https://github.com/VenusProtocol/protocol-reserve/commit/cd3c32e17f91dbcee0aa40a096c9df008a50f00d))

## 1.0.0 (2023-10-19)


### Features

* accrue prime interest and getUnreleasedFunds ([0f44155](https://github.com/VenusProtocol/protocol-reserve/commit/0f441552a35f41fc110e6e3fe4455385dfd25fa6))
* add asset to prime and make prime optional ([4ddd2ae](https://github.com/VenusProtocol/protocol-reserve/commit/4ddd2aeb22739479e309d7bc6d2fcade024f4033))
* added deploy script ([d89237e](https://github.com/VenusProtocol/protocol-reserve/commit/d89237eee4e60af3d265653e547f755375275ed7))
* added mainnet deployments ([d781471](https://github.com/VenusProtocol/protocol-reserve/commit/d781471e5ac52b9e6cc9403b0ca297a8a059f421))
* added prime interface ([c035bbe](https://github.com/VenusProtocol/protocol-reserve/commit/c035bbe0653115a9f5ca3693675fee16b44e1858))
* configuration tests ([386b2d5](https://github.com/VenusProtocol/protocol-reserve/commit/386b2d54ebf3834766292313af7577ec617d5af2))
* deployed new contract ([01b3e62](https://github.com/VenusProtocol/protocol-reserve/commit/01b3e621f60f41dc88727df268eb6259ca8c7bf3))
* destination addresses and distribution percent ([28de15b](https://github.com/VenusProtocol/protocol-reserve/commit/28de15b390c958ef529f6a10dd7640d58b7795db))
* distribute assets to configured targets ([bd18801](https://github.com/VenusProtocol/protocol-reserve/commit/bd1880190c74c55faff15a5f9aca38da15b6c2dc))
* dynamic destinations and split funds based of comptroller ([bc8f342](https://github.com/VenusProtocol/protocol-reserve/commit/bc8f342ecf14294e7dbfbf13014db44707cd71aa))
* func to get distribution config ([0a7c47e](https://github.com/VenusProtocol/protocol-reserve/commit/0a7c47ebb3a79b985a2725f9ce3458017133de4c))
* integrate acm ([4341f0f](https://github.com/VenusProtocol/protocol-reserve/commit/4341f0fff8254efb41351f798abba3344a3c5f61))
* remove unneeded dependencies ([3d81f0b](https://github.com/VenusProtocol/protocol-reserve/commit/3d81f0b92528eea0d322cce6e13d6f94e2cc5bfc))
* remove zero percentage config ([c7ef4b0](https://github.com/VenusProtocol/protocol-reserve/commit/c7ef4b0939446c84312b1e44b8e6034ac584ba8a))
* store reserve balance based on schema ([1a452e0](https://github.com/VenusProtocol/protocol-reserve/commit/1a452e005cec558d47a7a9a04df75fcb33b2eb30))
* tests for collecting assets income ([6275765](https://github.com/VenusProtocol/protocol-reserve/commit/62757657ec81a5c955bee5713a40f60bcf6ee8b0))
* tests for income collection and distribution ([50e7f9b](https://github.com/VenusProtocol/protocol-reserve/commit/50e7f9b0c1455e3c9ba3e2395c5d24cec79b5163))
* track reserves based on income type ([be4ceac](https://github.com/VenusProtocol/protocol-reserve/commit/be4ceace6cc2c052a4717319ca28cda1bd13ec1c))


### Bug Fixes

* ability to set multiple configs and percent should be 100 ([2787ba5](https://github.com/VenusProtocol/protocol-reserve/commit/2787ba520371746f703791e29ad2c85fa9157c1e))
* add func to get total targets ([824b9e4](https://github.com/VenusProtocol/protocol-reserve/commit/824b9e4c0d48d13b675014d595301177a60bd340))
* added 3 indexes ([bd73c11](https://github.com/VenusProtocol/protocol-reserve/commit/bd73c112deae980b0281a68894eb68707709acf9))
* added event when config removed ([4346fa9](https://github.com/VenusProtocol/protocol-reserve/commit/4346fa92db4347b6b56483b7ff6dfda52ce87a2b))
* added events for distribution config ([47b9267](https://github.com/VenusProtocol/protocol-reserve/commit/47b9267959e70bfcdcb9689b9f774891fc12880e))
* added indexed to asset ([0614f4f](https://github.com/VenusProtocol/protocol-reserve/commit/0614f4f9ab339793e7c5121e19e703f6618ef32c))
* added netspec and resolved lint issues ([92cc249](https://github.com/VenusProtocol/protocol-reserve/commit/92cc2491a0e1b928b2b968f5c9e729461dcca891))
* added nonReentrant to updateAssetsState ([1047224](https://github.com/VenusProtocol/protocol-reserve/commit/10472241b503438891b784e7f62a776282240e62))
* break loop to optimise gas ([86ec492](https://github.com/VenusProtocol/protocol-reserve/commit/86ec492fa78eae192aaea521564f390b0b90e802))
* bump hardhat version ([a16d980](https://github.com/VenusProtocol/protocol-reserve/commit/a16d9801da15072b49cf6e70628afd1365ba6fa4))
* change getScheme to _getSchema ([aee1f22](https://github.com/VenusProtocol/protocol-reserve/commit/aee1f22f6f779129b610b419becbb967a117d387))
* change i++ to ++i ([f6f9aa0](https://github.com/VenusProtocol/protocol-reserve/commit/f6f9aa025073e83806554fbbabd51630b78e3dfb))
* change memory to calldata ([1805452](https://github.com/VenusProtocol/protocol-reserve/commit/1805452f3228d261e1bae952585ddc242a0a353e))
* change percentage type from uint256 to uint8 ([4a97743](https://github.com/VenusProtocol/protocol-reserve/commit/4a977439961a14a364537338cfa80c8a2fef7e4c))
* change storage to memory ([874fe90](https://github.com/VenusProtocol/protocol-reserve/commit/874fe902fb7dc7655bce3bc901f4b6a4294ea3e6))
* changed prime address ([b2753f5](https://github.com/VenusProtocol/protocol-reserve/commit/b2753f57adb5c22d497d5e131382a73a010d72fd))
* create seperate func to get schema type ([9e44047](https://github.com/VenusProtocol/protocol-reserve/commit/9e44047b7fd2cc22d387c7091f2c5fc5d68ac8f4))
* deployed new contracts ([f29643c](https://github.com/VenusProtocol/protocol-reserve/commit/f29643c6ea47350ba371c110b133253d1c633150))
* deployed new contracts with max percent fix ([ef57366](https://github.com/VenusProtocol/protocol-reserve/commit/ef573669e574509500034622f98721b0cf19d771))
* deployed to mainnet ([3a568cc](https://github.com/VenusProtocol/protocol-reserve/commit/3a568ccd3e9f53b3b92d593bbae6fb4b82c874d7))
* fix folder names ([b801a93](https://github.com/VenusProtocol/protocol-reserve/commit/b801a93ba7682d94e9708682dc531915cdcc6b67))
* fix function name ([f80db3b](https://github.com/VenusProtocol/protocol-reserve/commit/f80db3be5b5a7810f393566b23283205bfc45f13))
* fix named imports ([6d7e326](https://github.com/VenusProtocol/protocol-reserve/commit/6d7e3260b7d5e474262e2c28d09f7eadc9e7e33a))
* fix tests ([becfa34](https://github.com/VenusProtocol/protocol-reserve/commit/becfa34bb134fef08acfd4da82c5fe53216e34aa))
* fixed ci test ([9660452](https://github.com/VenusProtocol/protocol-reserve/commit/9660452a497e78d7acb0bde0cf44434e09ac174b))
* fixed comptroller address and redeployed ([2f49a58](https://github.com/VenusProtocol/protocol-reserve/commit/2f49a58301ac0f8d7cd1de716737dd3d0e6f3e74))
* fixed dependency ([b80107e](https://github.com/VenusProtocol/protocol-reserve/commit/b80107e9b18ffaa44e529fcc824dd4dc4976d5ce))
* fixed func signature ([db7f946](https://github.com/VenusProtocol/protocol-reserve/commit/db7f94667323a35ce7281a868e8c7cf3f7237eb2))
* fixed lint and schema order ([5d2b7a7](https://github.com/VenusProtocol/protocol-reserve/commit/5d2b7a7c4e3d76a5365ff9738902964ce2d43dad))
* fixed syntax ([7217c9f](https://github.com/VenusProtocol/protocol-reserve/commit/7217c9f8137ae37e5a95c52f1cf75eeea9bbd28a))
* fixed tests ([bd0e9c3](https://github.com/VenusProtocol/protocol-reserve/commit/bd0e9c38cbbc03d8745f0bf7a8518912aa712bd3))
* fixed total balance calculation and tests ([f149fab](https://github.com/VenusProtocol/protocol-reserve/commit/f149fab865059e3b1371d1fdcbc09c4b0050e6bb))
* function to ensure percentage check ([46a1c3a](https://github.com/VenusProtocol/protocol-reserve/commit/46a1c3a758fce9e3abce2cb657dd6b65f617f78b))
* handle vbnb market ([332fb34](https://github.com/VenusProtocol/protocol-reserve/commit/332fb34ef09494f6d6068e63078631bd667a7892))
* make core pool comptroller immutable ([f5d7185](https://github.com/VenusProtocol/protocol-reserve/commit/f5d7185632d97ab1d16e7b77fc130feefd0d30c0))
* make totalAssetReserve as public ([187d70c](https://github.com/VenusProtocol/protocol-reserve/commit/187d70c941778cd8e924abb8f2903b19a2c1d68b))
* make vBNB public ([d6a0a83](https://github.com/VenusProtocol/protocol-reserve/commit/d6a0a83e3313b5ee0c215099677c9e328d561b30))
* make WBNB public ([eea9206](https://github.com/VenusProtocol/protocol-reserve/commit/eea920619f5f69a282d5975b8d34a5492bb7bbdd))
* mark funcs as view ([e1385e1](https://github.com/VenusProtocol/protocol-reserve/commit/e1385e1420653566dc75415a603dac2c8de6af11))
* new testnet deployment ([f407ca5](https://github.com/VenusProtocol/protocol-reserve/commit/f407ca55fdcd14d493b80709c11739d50f0bcefc))
* only accrue interest in prime during release funds ([bc97d7d](https://github.com/VenusProtocol/protocol-reserve/commit/bc97d7db7693ca272ab0c4d0c3ed4fc065f919ec))
* only owner can set registry and prime ([e4e31d2](https://github.com/VenusProtocol/protocol-reserve/commit/e4e31d2a2a054cc9bdfaaa7541bb669603338e96))
* optimise gas by storing length of targets in temp var ([048f348](https://github.com/VenusProtocol/protocol-reserve/commit/048f34889170ae03da1d574b38a7d34a2b1750c6))
* optimise loop ([0c17b63](https://github.com/VenusProtocol/protocol-reserve/commit/0c17b63dcda6f54b9c508a00156f48607ab03011))
* optimise loop ([4e28a44](https://github.com/VenusProtocol/protocol-reserve/commit/4e28a446fc3e1fcca95bf5619c55409f3c1be6aa))
* optimise removal of config ([18c16f7](https://github.com/VenusProtocol/protocol-reserve/commit/18c16f785f8cfd07e1e1f778d0d1208fbc86b4fc))
* prime market getter for releaseFunds in psr ([838fbc3](https://github.com/VenusProtocol/protocol-reserve/commit/838fbc3cf4c659739469cf1d9eccbf957399d5b3))
* PSP-01 ([762c054](https://github.com/VenusProtocol/protocol-reserve/commit/762c054693c39a693fbaa2bdb1680635146f79c1))
* PSR-04 ([64e4d6a](https://github.com/VenusProtocol/protocol-reserve/commit/64e4d6ae569fcd5fa81ae917bf0b4693b955f492))
* PSR-05 ([1320fff](https://github.com/VenusProtocol/protocol-reserve/commit/1320fff4f7d92f3da41a4d5f99edde6e02722012))
* PSR-06 ([3e4e013](https://github.com/VenusProtocol/protocol-reserve/commit/3e4e0135b2f9ff959cdd619b2640a006fe4fd91e))
* PSR-06 ([f02e8ca](https://github.com/VenusProtocol/protocol-reserve/commit/f02e8ca0b4686e44bdcd45eada3bf57c9b23846b))
* PSR-07 ([e9ae778](https://github.com/VenusProtocol/protocol-reserve/commit/e9ae778b5d6580ac46f8dfaccf4342f567004e16))
* PSR-08 ([95b2ff4](https://github.com/VenusProtocol/protocol-reserve/commit/95b2ff4902b30434cef21954b2ce04a61d275564))
* PSR-09 ([7891517](https://github.com/VenusProtocol/protocol-reserve/commit/789151704b35cd79b236d9e7873f2ea6a0a271c4))
* PSR-11 ([24a9566](https://github.com/VenusProtocol/protocol-reserve/commit/24a956611704ef455361b09bede8df5abcda4bfe))
* re-deployed contracts ([4ea9364](https://github.com/VenusProtocol/protocol-reserve/commit/4ea9364cb12ff953b61a50ee47fc316186023069))
* re-deployed with existing proxy admin ([b36a718](https://github.com/VenusProtocol/protocol-reserve/commit/b36a71808524166f465f4d1dc5bb50e98aafc423))
* redeployed contracts ([abebfe5](https://github.com/VenusProtocol/protocol-reserve/commit/abebfe5a956afd06e87d15e20cc3e2b120cade70))
* redeployed with new proxy ([e98455c](https://github.com/VenusProtocol/protocol-reserve/commit/e98455cdeffa10a260f319e43b0d7e9af417e418))
* release and accrue prime interest duing release ([c9c7c44](https://github.com/VenusProtocol/protocol-reserve/commit/c9c7c44d5398b0ed9dd65562349f602f3fd2798b))
* release funds dynamically based on schemas ([d1c6b7d](https://github.com/VenusProtocol/protocol-reserve/commit/d1c6b7d52e40a380dd7e1804354e8d55b9b941f8))
* remove console.log ([d8e8551](https://github.com/VenusProtocol/protocol-reserve/commit/d8e855167ff1223f3ad4beecbe773cc8780bb1ae))
* remove extra parameter for releaseFund ([dbef07d](https://github.com/VenusProtocol/protocol-reserve/commit/dbef07dfb3d537a27a1810cd3bc2c89c0a43d6fd))
* remove pool registry dependency for deployment ([f8039fc](https://github.com/VenusProtocol/protocol-reserve/commit/f8039fca475ae605a2dabd855c2a744d407d1d75))
* remove prime dependency ([60286c4](https://github.com/VenusProtocol/protocol-reserve/commit/60286c49517b8ccf3c93b01c47b0c47bd284e809))
* remove undefined income type ([8521ad1](https://github.com/VenusProtocol/protocol-reserve/commit/8521ad19f0826b8b12b51ecd28c39a4f2a1dfb2d))
* remove unnecessary checks for loop limit ([e3146d1](https://github.com/VenusProtocol/protocol-reserve/commit/e3146d143956e992c25b811d65873f7279cb9400))
* remove unused event ([12d87b2](https://github.com/VenusProtocol/protocol-reserve/commit/12d87b2be9ad750345e6163cb79e2902f328de74))
* remove unwanted contracts and interfaces ([2074ce0](https://github.com/VenusProtocol/protocol-reserve/commit/2074ce06aefcbad17de03b03dbb51b5c65cabefc))
* removed require statement ([01dee59](https://github.com/VenusProtocol/protocol-reserve/commit/01dee59345c17db2192a0154b734e23c7853fa75))
* removed unused events and methods ([535933b](https://github.com/VenusProtocol/protocol-reserve/commit/535933b122e88aee133b9df8f9cbf30a432d3a39))
* renamed schemas ([f0d6c4d](https://github.com/VenusProtocol/protocol-reserve/commit/f0d6c4deca3cf599989154ad97c9a8679d39a2c4))
* replace isPrime with vTokenForAsset ([6814574](https://github.com/VenusProtocol/protocol-reserve/commit/681457488bbc3f2aae92df200324f20183ab1c50))
* resolved conflict ([29e62de](https://github.com/VenusProtocol/protocol-reserve/commit/29e62de80e88afb093b19c95db1291963294d62f))
* revert added 3 indexes ([cae16fa](https://github.com/VenusProtocol/protocol-reserve/commit/cae16fa864802c6666e9cd82b4722faf0026e71d))
* save gas if nothing to release ([978b6ec](https://github.com/VenusProtocol/protocol-reserve/commit/978b6ecc5f7dad265dbb4563268b53205b05880b))
* simplify require statement ([294ca74](https://github.com/VenusProtocol/protocol-reserve/commit/294ca74a5da947bdfa2825443ab29d76ece84b0d))
* updated deployment ([a7242b8](https://github.com/VenusProtocol/protocol-reserve/commit/a7242b8c713ca957ae002290fc22bc64a3b56acc))
* updated schemas ([010c545](https://github.com/VenusProtocol/protocol-reserve/commit/010c545dce8ac7757792816a1fa81bad0ed0c3de))
* use custom errors ([5af3b3c](https://github.com/VenusProtocol/protocol-reserve/commit/5af3b3c360dd1a4825d5285cfcebea5aee51e9bf))
* use j for inner loop ([fe12bd5](https://github.com/VenusProtocol/protocol-reserve/commit/fe12bd56ed10262328fef0b6a0999db401a0860b))
* use node 18 ([ed4685a](https://github.com/VenusProtocol/protocol-reserve/commit/ed4685af84f29e3476288c2cd88e232d6d3c3e6c))
* use onlyowner ([e89d4bd](https://github.com/VenusProtocol/protocol-reserve/commit/e89d4bd01e70f3ea0e70e005b08dcba2a9fa17fd))
* VEN-12 ([65c4f91](https://github.com/VenusProtocol/protocol-reserve/commit/65c4f91f239a454f6bb820242b02dcd64511901b))
* VPB-01 ([9b894de](https://github.com/VenusProtocol/protocol-reserve/commit/9b894de0031557d9241a412efd18a0220598c562))
* VPB-03 ([11b5787](https://github.com/VenusProtocol/protocol-reserve/commit/11b5787e33cb9b973c64bd15ba0183b067c0ca71))

## [1.0.0-dev.7](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.6...v1.0.0-dev.7) (2023-10-18)


### Features

* add asset to prime and make prime optional ([4ddd2ae](https://github.com/VenusProtocol/protocol-reserve/commit/4ddd2aeb22739479e309d7bc6d2fcade024f4033))
* added deploy script ([d89237e](https://github.com/VenusProtocol/protocol-reserve/commit/d89237eee4e60af3d265653e547f755375275ed7))
* added mainnet deployments ([d781471](https://github.com/VenusProtocol/protocol-reserve/commit/d781471e5ac52b9e6cc9403b0ca297a8a059f421))
* deployed new contract ([01b3e62](https://github.com/VenusProtocol/protocol-reserve/commit/01b3e621f60f41dc88727df268eb6259ca8c7bf3))
* remove zero percentage config ([c7ef4b0](https://github.com/VenusProtocol/protocol-reserve/commit/c7ef4b0939446c84312b1e44b8e6034ac584ba8a))


### Bug Fixes

* added 3 indexes ([bd73c11](https://github.com/VenusProtocol/protocol-reserve/commit/bd73c112deae980b0281a68894eb68707709acf9))
* added event when config removed ([4346fa9](https://github.com/VenusProtocol/protocol-reserve/commit/4346fa92db4347b6b56483b7ff6dfda52ce87a2b))
* added indexed to asset ([0614f4f](https://github.com/VenusProtocol/protocol-reserve/commit/0614f4f9ab339793e7c5121e19e703f6618ef32c))
* change getScheme to _getSchema ([aee1f22](https://github.com/VenusProtocol/protocol-reserve/commit/aee1f22f6f779129b610b419becbb967a117d387))
* change memory to calldata ([1805452](https://github.com/VenusProtocol/protocol-reserve/commit/1805452f3228d261e1bae952585ddc242a0a353e))
* change percentage type from uint256 to uint8 ([4a97743](https://github.com/VenusProtocol/protocol-reserve/commit/4a977439961a14a364537338cfa80c8a2fef7e4c))
* changed prime address ([b2753f5](https://github.com/VenusProtocol/protocol-reserve/commit/b2753f57adb5c22d497d5e131382a73a010d72fd))
* deployed new contracts ([f29643c](https://github.com/VenusProtocol/protocol-reserve/commit/f29643c6ea47350ba371c110b133253d1c633150))
* deployed new contracts with max percent fix ([ef57366](https://github.com/VenusProtocol/protocol-reserve/commit/ef573669e574509500034622f98721b0cf19d771))
* deployed to mainnet ([3a568cc](https://github.com/VenusProtocol/protocol-reserve/commit/3a568ccd3e9f53b3b92d593bbae6fb4b82c874d7))
* fixed ci test ([9660452](https://github.com/VenusProtocol/protocol-reserve/commit/9660452a497e78d7acb0bde0cf44434e09ac174b))
* fixed comptroller address and redeployed ([2f49a58](https://github.com/VenusProtocol/protocol-reserve/commit/2f49a58301ac0f8d7cd1de716737dd3d0e6f3e74))
* fixed dependency ([b80107e](https://github.com/VenusProtocol/protocol-reserve/commit/b80107e9b18ffaa44e529fcc824dd4dc4976d5ce))
* fixed func signature ([db7f946](https://github.com/VenusProtocol/protocol-reserve/commit/db7f94667323a35ce7281a868e8c7cf3f7237eb2))
* new testnet deployment ([f407ca5](https://github.com/VenusProtocol/protocol-reserve/commit/f407ca55fdcd14d493b80709c11739d50f0bcefc))
* optimise removal of config ([18c16f7](https://github.com/VenusProtocol/protocol-reserve/commit/18c16f785f8cfd07e1e1f778d0d1208fbc86b4fc))
* re-deployed contracts ([4ea9364](https://github.com/VenusProtocol/protocol-reserve/commit/4ea9364cb12ff953b61a50ee47fc316186023069))
* re-deployed with existing proxy admin ([b36a718](https://github.com/VenusProtocol/protocol-reserve/commit/b36a71808524166f465f4d1dc5bb50e98aafc423))
* redeployed contracts ([abebfe5](https://github.com/VenusProtocol/protocol-reserve/commit/abebfe5a956afd06e87d15e20cc3e2b120cade70))
* redeployed with new proxy ([e98455c](https://github.com/VenusProtocol/protocol-reserve/commit/e98455cdeffa10a260f319e43b0d7e9af417e418))
* remove prime dependency ([60286c4](https://github.com/VenusProtocol/protocol-reserve/commit/60286c49517b8ccf3c93b01c47b0c47bd284e809))
* removed require statement ([01dee59](https://github.com/VenusProtocol/protocol-reserve/commit/01dee59345c17db2192a0154b734e23c7853fa75))
* revert added 3 indexes ([cae16fa](https://github.com/VenusProtocol/protocol-reserve/commit/cae16fa864802c6666e9cd82b4722faf0026e71d))
* updated deployment ([a7242b8](https://github.com/VenusProtocol/protocol-reserve/commit/a7242b8c713ca957ae002290fc22bc64a3b56acc))
* updated schemas ([010c545](https://github.com/VenusProtocol/protocol-reserve/commit/010c545dce8ac7757792816a1fa81bad0ed0c3de))
* VEN-12 ([65c4f91](https://github.com/VenusProtocol/protocol-reserve/commit/65c4f91f239a454f6bb820242b02dcd64511901b))

## [1.0.0-dev.6](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.5...v1.0.0-dev.6) (2023-09-25)


### Features

* func to get distribution config ([0a7c47e](https://github.com/VenusProtocol/protocol-reserve/commit/0a7c47ebb3a79b985a2725f9ce3458017133de4c))


### Bug Fixes

* added netspec and resolved lint issues ([92cc249](https://github.com/VenusProtocol/protocol-reserve/commit/92cc2491a0e1b928b2b968f5c9e729461dcca891))
* fixed tests ([bd0e9c3](https://github.com/VenusProtocol/protocol-reserve/commit/bd0e9c38cbbc03d8745f0bf7a8518912aa712bd3))
* PSP-01 ([762c054](https://github.com/VenusProtocol/protocol-reserve/commit/762c054693c39a693fbaa2bdb1680635146f79c1))

## [1.0.0-dev.5](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.4...v1.0.0-dev.5) (2023-09-13)


### Bug Fixes

* prime market getter for releaseFunds in psr ([838fbc3](https://github.com/VenusProtocol/protocol-reserve/commit/838fbc3cf4c659739469cf1d9eccbf957399d5b3))

## [1.0.0-dev.4](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0-dev.3...v1.0.0-dev.4) (2023-08-25)


### Bug Fixes

* added nonReentrant to updateAssetsState ([1047224](https://github.com/VenusProtocol/protocol-reserve/commit/10472241b503438891b784e7f62a776282240e62))
* only owner can set registry and prime ([e4e31d2](https://github.com/VenusProtocol/protocol-reserve/commit/e4e31d2a2a054cc9bdfaaa7541bb669603338e96))
* PSR-04 ([64e4d6a](https://github.com/VenusProtocol/protocol-reserve/commit/64e4d6ae569fcd5fa81ae917bf0b4693b955f492))
* PSR-05 ([1320fff](https://github.com/VenusProtocol/protocol-reserve/commit/1320fff4f7d92f3da41a4d5f99edde6e02722012))
* PSR-06 ([3e4e013](https://github.com/VenusProtocol/protocol-reserve/commit/3e4e0135b2f9ff959cdd619b2640a006fe4fd91e))
* PSR-06 ([f02e8ca](https://github.com/VenusProtocol/protocol-reserve/commit/f02e8ca0b4686e44bdcd45eada3bf57c9b23846b))
* PSR-07 ([e9ae778](https://github.com/VenusProtocol/protocol-reserve/commit/e9ae778b5d6580ac46f8dfaccf4342f567004e16))
* PSR-08 ([95b2ff4](https://github.com/VenusProtocol/protocol-reserve/commit/95b2ff4902b30434cef21954b2ce04a61d275564))
* PSR-09 ([7891517](https://github.com/VenusProtocol/protocol-reserve/commit/789151704b35cd79b236d9e7873f2ea6a0a271c4))
* PSR-11 ([24a9566](https://github.com/VenusProtocol/protocol-reserve/commit/24a956611704ef455361b09bede8df5abcda4bfe))
* remove unnecessary checks for loop limit ([e3146d1](https://github.com/VenusProtocol/protocol-reserve/commit/e3146d143956e992c25b811d65873f7279cb9400))
* use onlyowner ([e89d4bd](https://github.com/VenusProtocol/protocol-reserve/commit/e89d4bd01e70f3ea0e70e005b08dcba2a9fa17fd))
* VPB-01 ([9b894de](https://github.com/VenusProtocol/protocol-reserve/commit/9b894de0031557d9241a412efd18a0220598c562))
* VPB-03 ([11b5787](https://github.com/VenusProtocol/protocol-reserve/commit/11b5787e33cb9b973c64bd15ba0183b067c0ca71))

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
