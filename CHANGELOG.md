## [1.4.0](https://github.com/VenusProtocol/protocol-reserve/compare/v1.3.0...v1.4.0) (2024-01-24)


### Features

* absract token transformer ([848271f](https://github.com/VenusProtocol/protocol-reserve/commit/848271f52d369766c2cde4f0e6b5184c6fbccd5f))
* add conversion config method for setting configs in batch ([baf6dfb](https://github.com/VenusProtocol/protocol-reserve/commit/baf6dfb49f8549699fb8d47eebd9baa1d28736da))
* add deployment files for bsc mainnet ([2abea71](https://github.com/VenusProtocol/protocol-reserve/commit/2abea7175c458539990d48229e692a90bda73be6))
* add deployment scripts for converters, ConverterNetwork and XVSVaultTreasury ([6286a0a](https://github.com/VenusProtocol/protocol-reserve/commit/6286a0ad51a62e3f19049f69dc117ec247961500))
* add getters for getAmountIn and getAmountOut ([26e3828](https://github.com/VenusProtocol/protocol-reserve/commit/26e3828da3381154eec514947c48ff23a7897b88))
* added ConverterNetwork contract and tests ([188562d](https://github.com/VenusProtocol/protocol-reserve/commit/188562d406c8bff38834a9b4adec5dcef361fb16))
* added private conversion functionality ([268a107](https://github.com/VenusProtocol/protocol-reserve/commit/268a1077886ed77ccd7ba1327d09829bf5bb672c))
* added setter for the direct transfer assets for riskfund ([46cd2cb](https://github.com/VenusProtocol/protocol-reserve/commit/46cd2cb1f80467a74f73cd78b00c5e61d729078a))
* risk fund contract ([08d449b](https://github.com/VenusProtocol/protocol-reserve/commit/08d449bdc7efdc99a59bc819725a9b51c0fb78be))
* support for native wrapped token ([1a41ef5](https://github.com/VenusProtocol/protocol-reserve/commit/1a41ef5c8209773aa381ce60479517a5f2253a69))
* sweep token for pools ([768a392](https://github.com/VenusProtocol/protocol-reserve/commit/768a392741df7cf67c9adcde3bdae31f18f84f0c))
* updating deployment files ([7f148a9](https://github.com/VenusProtocol/protocol-reserve/commit/7f148a97a80073c86dec165cabd9628ff1f877a5))
* updating deployment files ([45481a3](https://github.com/VenusProtocol/protocol-reserve/commit/45481a3909ef3d20c4b3a957a187f9b4c492db8e))
* updating deployment files ([13813be](https://github.com/VenusProtocol/protocol-reserve/commit/13813befcb96762423d58849e741438e722d34a3))
* updating deployment files ([34ca45a](https://github.com/VenusProtocol/protocol-reserve/commit/34ca45a6b2645a1c9758cabafe5aae4916ea9664))
* ven-1471 risk fund transformer ([89c4bf8](https://github.com/VenusProtocol/protocol-reserve/commit/89c4bf8eb29611893d73d2ed7f8bc12574f64e9d))
* ven-1472 xvs vault transformer ([8319971](https://github.com/VenusProtocol/protocol-reserve/commit/83199710d15a6e9e76256c6a0694343308eb52cf))
* ven-1473 xvs vault treasury ([cf8f101](https://github.com/VenusProtocol/protocol-reserve/commit/cf8f1014fdd9cdf26bb4bcfa2c4cdcbde8d1fb17))
* ven-1827 added core pool in risk fund converter ([57dceb0](https://github.com/VenusProtocol/protocol-reserve/commit/57dceb01b790868312c33c3aa800f0a9a7285bc9))
* ven-1828 added sweep token in risk fund ([91bbfbb](https://github.com/VenusProtocol/protocol-reserve/commit/91bbfbb17afb620acf89852a3d955e72435dc9cf))
* ven-1834 functionality for multiple assets in risk fund ([bbaf19a](https://github.com/VenusProtocol/protocol-reserve/commit/bbaf19a75ffecb173141ec8a3d659977968e9d0b))
* ven-1883 deployment script for riskFundConverter ([aee3c6c](https://github.com/VenusProtocol/protocol-reserve/commit/aee3c6c47c0805fd030abb52e9388228b67567de))


### Bug Fixes

* add reentrancy guard to getPoolAssetReserve function ([72e1b37](https://github.com/VenusProtocol/protocol-reserve/commit/72e1b37676587dbcb0e8ea1502081c9646d52f3b))
* added miannet addresses in the convertor script ([5d1c6b3](https://github.com/VenusProtocol/protocol-reserve/commit/5d1c6b3ff73e0f9934f07c1a24c257526d942c93))
* ATC-01 ([f76345d](https://github.com/VenusProtocol/protocol-reserve/commit/f76345d1780e82e91ae138a3cdbdf9b38fbfa3ff))
* ATC-03 ([a5caf65](https://github.com/VenusProtocol/protocol-reserve/commit/a5caf65aac3a12962c7f363c0a8c1af342abd9a0))
* ATC-04 ([1c558e8](https://github.com/VenusProtocol/protocol-reserve/commit/1c558e84934784f331940ffbc27f9efa294fe432))
* ATC-04 ([e37341c](https://github.com/VenusProtocol/protocol-reserve/commit/e37341ce91123454f7a0faecb81569d9141a5882))
* ATC-05 ([a71fe6f](https://github.com/VenusProtocol/protocol-reserve/commit/a71fe6fda9d41d7a3f4dbd430947bd5a6633e248))
* ATT-01 ([abe7ead](https://github.com/VenusProtocol/protocol-reserve/commit/abe7eadf62571ef4cd803f20c208390f6ff646c7))
* ATT-02 ([c8588a0](https://github.com/VenusProtocol/protocol-reserve/commit/c8588a01c5cef91e887aaedcbefef1405a58f3e6))
* ATT-02 ([11352cd](https://github.com/VenusProtocol/protocol-reserve/commit/11352cd7621b366100dc35ffcd1fe23de29d9478))
* CNC-02 ([f52d56a](https://github.com/VenusProtocol/protocol-reserve/commit/f52d56a08e482f63d204320354a60dff1024245e))
* CNC-04 ([2ba7503](https://github.com/VenusProtocol/protocol-reserve/commit/2ba750391140832648f374fe4d1e570173330942))
* convertForExactTokens bug regarding deflationary token ([5088e0f](https://github.com/VenusProtocol/protocol-reserve/commit/5088e0f86c8a23a6234ab10ced21517ab7ef1f01))
* deployment scripts and updated deployment files ([5468dc9](https://github.com/VenusProtocol/protocol-reserve/commit/5468dc9774aa318563f7ddd8cefede4c8542be09))
* fork tests for risk fund converter ([255e01a](https://github.com/VenusProtocol/protocol-reserve/commit/255e01a07b0f07de0ce8f328909ff97d3349227c))
* gas optimization for riskfundv2 ([cbb1651](https://github.com/VenusProtocol/protocol-reserve/commit/cbb16515857745443aa10f8be0a8b650b79af6df))
* get amount method ([3b21bc7](https://github.com/VenusProtocol/protocol-reserve/commit/3b21bc733d38490866dc609bf7769495615319c5))
* L-01 ([52eb722](https://github.com/VenusProtocol/protocol-reserve/commit/52eb7225bcbe030b6568c1a0d35becbdd082530c))
* L-02 ([6b6e9e4](https://github.com/VenusProtocol/protocol-reserve/commit/6b6e9e4e0bc557afec42402fc26ccee9641b0826))
* L-03 ([6bd7f9a](https://github.com/VenusProtocol/protocol-reserve/commit/6bd7f9ae7d86d361b2bd02083dac60441d869f8c))
* L-04 ([f3e40c3](https://github.com/VenusProtocol/protocol-reserve/commit/f3e40c3a240593a5f7ee0c392b6f92fa8d67a7c3))
* lint issues ([3743f49](https://github.com/VenusProtocol/protocol-reserve/commit/3743f49d53f4cab488f941ac4fb54b4b58e219f5))
* make comptroller and vBNB immutable ([6871238](https://github.com/VenusProtocol/protocol-reserve/commit/687123893ace5662bdfd3f976cb9eeaa71130a42))
* merge conflicts ([5e6aa8b](https://github.com/VenusProtocol/protocol-reserve/commit/5e6aa8b4d8a8da169cf7aa8ccb3d529bcc6856cc))
* minor fixes ([166d40b](https://github.com/VenusProtocol/protocol-reserve/commit/166d40be0cca5145afb982f39ebdc5d2580568d5))
* minor fixes ([7c18feb](https://github.com/VenusProtocol/protocol-reserve/commit/7c18feb0875f273090602aff5a03c63407334920))
* N-01 ([1af57c2](https://github.com/VenusProtocol/protocol-reserve/commit/1af57c2102159f275986a45e45e2d05c3134a943))
* N-02 ([b1244b3](https://github.com/VenusProtocol/protocol-reserve/commit/b1244b36d963b4762fa2b6ee0c1e139296e1e903))
* N-03 ([9994f12](https://github.com/VenusProtocol/protocol-reserve/commit/9994f12981204e0716f45c27c5213a3086f576ee))
* N-04 ([af3d4fc](https://github.com/VenusProtocol/protocol-reserve/commit/af3d4fcad648b06813358ca70f754d519d749d18))
* N-05 ([22a231a](https://github.com/VenusProtocol/protocol-reserve/commit/22a231a407c4da015115e17fb7b2f1ca481b9604))
* N-05 ([ae9e07b](https://github.com/VenusProtocol/protocol-reserve/commit/ae9e07b90a37d9d5c7f7db48e890a3c5b1c19585))
* N-06 ([84cbf18](https://github.com/VenusProtocol/protocol-reserve/commit/84cbf18db1f4a1d6dddf4f18ae6abb0d9fdddee5))
* N-07 ([a265d02](https://github.com/VenusProtocol/protocol-reserve/commit/a265d025bf6595f76a0cf8822c191f97a1be37cb))
* n1 ([7fd547e](https://github.com/VenusProtocol/protocol-reserve/commit/7fd547e6f9d589a73d1baf08fccd4ebbd776e9a9))
* n2 ([2d18458](https://github.com/VenusProtocol/protocol-reserve/commit/2d1845833a78f2da55eb8ae2c13605264e1b1c22))
* n3 ([624b0f1](https://github.com/VenusProtocol/protocol-reserve/commit/624b0f1f1f9d1e5a919a03ec7573bb1ae89f2f6e))
* post conversion hook bug ([15c252d](https://github.com/VenusProtocol/protocol-reserve/commit/15c252d637ad600d0d0017c7be54f2ff3b40ed13))
* postConversionHook error ([14d56fb](https://github.com/VenusProtocol/protocol-reserve/commit/14d56fb000c379c43b7418e2e15be61b2d5499cc))
* pr comments ([2339328](https://github.com/VenusProtocol/protocol-reserve/commit/2339328efb9571e2be2f7b09fd0fd6aad0798f07))
* pr comments ([8ef869a](https://github.com/VenusProtocol/protocol-reserve/commit/8ef869acea87739304b75a35b79cacc152133db7))
* pr comments ([554d804](https://github.com/VenusProtocol/protocol-reserve/commit/554d804df86900e232a5055e1ca3c85a9f0d169e))
* pr comments ([8d8f8c7](https://github.com/VenusProtocol/protocol-reserve/commit/8d8f8c786e598bf59b0d90edda59f8df16be84af))
* pr comments ([b176ddb](https://github.com/VenusProtocol/protocol-reserve/commit/b176ddb864628c56f5eee1bd58d6f165b8ab7a1a))
* pr comments ([23d4e99](https://github.com/VenusProtocol/protocol-reserve/commit/23d4e99719b57b939b75a731f48387b875722b5e))
* pr comments ([176a6f5](https://github.com/VenusProtocol/protocol-reserve/commit/176a6f50647191cdb86b58ccf77377d373a194c9))
* pr comments ([dc70688](https://github.com/VenusProtocol/protocol-reserve/commit/dc70688315616cba35501068d08ae8698994c904))
* pr comments ([a0d3f2a](https://github.com/VenusProtocol/protocol-reserve/commit/a0d3f2ad5fd685b55c692545beb29c387059bc87))
* pr comments ([3d64345](https://github.com/VenusProtocol/protocol-reserve/commit/3d64345e4d1d8ccf397b2c4439b5cfc2d34968bc))
* pr comments ([81bfa06](https://github.com/VenusProtocol/protocol-reserve/commit/81bfa06e88d4fe8f04efef8f5aaff02545531f6e))
* pr comments ([ecbb1ab](https://github.com/VenusProtocol/protocol-reserve/commit/ecbb1abe333e9b0b7ff5f130b7de9e6624fd2d95))
* pve-001 ([a1e6697](https://github.com/VenusProtocol/protocol-reserve/commit/a1e669790f14bf13d828d0f8f37f9beff37840b1))
* pve-002 ([fd20124](https://github.com/VenusProtocol/protocol-reserve/commit/fd201247db8c1e4ee6b6dcbdf3ee37ff05f0b23e))
* pve-003 ([92342eb](https://github.com/VenusProtocol/protocol-reserve/commit/92342eb81d4436cc0fa9a88d92b07615bebee562))
* pve-003-2 ([057dcee](https://github.com/VenusProtocol/protocol-reserve/commit/057dceef0ef5b762d349864b6572eb26f1620bd9))
* pve-005 ([74f9cb2](https://github.com/VenusProtocol/protocol-reserve/commit/74f9cb292fd8ecd53fcb37755047ae376a76dfa9))
* resolve comments ([3e60089](https://github.com/VenusProtocol/protocol-reserve/commit/3e600898ea8522c50f1b1361e378866889de9f41))
* resolved conflicts ([e5ad0df](https://github.com/VenusProtocol/protocol-reserve/commit/e5ad0dffc7ef7b99d57cb9fe8947c9655c6cadc3))
* resolved merge conflicts ([23662c0](https://github.com/VenusProtocol/protocol-reserve/commit/23662c06569d65af2e79035883f46fa296404b84))
* resolved merge conflicts ([cd353bd](https://github.com/VenusProtocol/protocol-reserve/commit/cd353bdae259bdbbe06e6eb017191b2ef1d9d437))
* resolved merge conflicts ([cdf4466](https://github.com/VenusProtocol/protocol-reserve/commit/cdf4466db03ef96876d0481b51366f0da9337aff))
* RFC-02 ([06914bd](https://github.com/VenusProtocol/protocol-reserve/commit/06914bd575affe5ce719797d6b53590ad44651db))
* RFC-04 ([83e5e1b](https://github.com/VenusProtocol/protocol-reserve/commit/83e5e1b2dc0e3ee445c410a7e3ae0588b835b6f1))
* RFV-03 ([cf5e371](https://github.com/VenusProtocol/protocol-reserve/commit/cf5e3713edb5c4a4f574881cb9f82d375625237e))
* RFV-06 ([42e67b7](https://github.com/VenusProtocol/protocol-reserve/commit/42e67b7189c3f243a3ec8667bd08761d53a4eebe))
* TCP-03 ([f4c8d1e](https://github.com/VenusProtocol/protocol-reserve/commit/f4c8d1e179c71a5cc10e9970ee45b4771e95c801))
* TCP-04 ([f8a8179](https://github.com/VenusProtocol/protocol-reserve/commit/f8a8179d23d378262a4213708731d0594dfa591f))
* TCP-05 ([cdd9e14](https://github.com/VenusProtocol/protocol-reserve/commit/cdd9e14e670829ae70515ee7b5c6a39b20790314))
* TCP-06 ([73bc544](https://github.com/VenusProtocol/protocol-reserve/commit/73bc544ef7cbcdc7e017001ec5de9e2a3d654ecd))
* TCV-01 ([9f579b1](https://github.com/VenusProtocol/protocol-reserve/commit/9f579b1ba0498ba74bc9e0acb007d22d8fbf9ca5))
* update yarn.lock ([fd5a56d](https://github.com/VenusProtocol/protocol-reserve/commit/fd5a56d2dbc2be4944c9037e4846a6fe7a4c6243))
* updatedsolidity-coverage depedency package ([caf7c41](https://github.com/VenusProtocol/protocol-reserve/commit/caf7c41c0bed5202272f63ac4d3144ba4e9b5a7f))
* use ex6 modules ([0293c92](https://github.com/VenusProtocol/protocol-reserve/commit/0293c92ce81b1faf360703cf350203569f4bfd21))
* ven-2007 l-02 ([0f58716](https://github.com/VenusProtocol/protocol-reserve/commit/0f587168094fc6682671f56ef8a92e26c677641b))
* ven-2007 l-03 ([a842667](https://github.com/VenusProtocol/protocol-reserve/commit/a8426677df622b6c59b62196eecf8d168f0ff2f8))
* ven-2007 l-04 ([a555053](https://github.com/VenusProtocol/protocol-reserve/commit/a555053d6a7d41e0389e5c01deffab985a392a30))
* ven-2007 l-05 ([35dc0a1](https://github.com/VenusProtocol/protocol-reserve/commit/35dc0a1211094458b2db4552ab07694001c6d6df))
* ven-2007 l-06 ([e558b15](https://github.com/VenusProtocol/protocol-reserve/commit/e558b1568840434b748582f4a3371c3bebec8a51))
* ven-2007 l-08 ([2be108d](https://github.com/VenusProtocol/protocol-reserve/commit/2be108d71b36897874e587033ceb5fd52ef90185))
* ven-2007 m-01 ([4025db0](https://github.com/VenusProtocol/protocol-reserve/commit/4025db080dbf0d9f19b38109e9da6f5e72cc9353))
* ven-2007 m-02 ([939da0a](https://github.com/VenusProtocol/protocol-reserve/commit/939da0aa86b65a98e59c56e5ddb03391c6f71fa7))
* ven-2007 n-01 ([5d0f03b](https://github.com/VenusProtocol/protocol-reserve/commit/5d0f03bd50771bfd77b139697f1c803b868a8549))
* ven-2007 n-02 ([91eb7a6](https://github.com/VenusProtocol/protocol-reserve/commit/91eb7a6f3aa8473b2724827c724efcb1ee6aaf3a))
* ven-2007 n-03 ([1e367e1](https://github.com/VenusProtocol/protocol-reserve/commit/1e367e1ebea6fffe91632b1586816cec8d8f1f3b))
* ven-2007 n-04 ([8d6389c](https://github.com/VenusProtocol/protocol-reserve/commit/8d6389c76606e02be64b833e0581d9d9defa8737))
* ven-2007 n-06 ([8227f4b](https://github.com/VenusProtocol/protocol-reserve/commit/8227f4babf156f79ffe8ce48461535055648cf5e))
* ven-2007 n-07 ([08bacb3](https://github.com/VenusProtocol/protocol-reserve/commit/08bacb307fa4dd63305982792726638a8ba03ff3))
* ven-2007 n-08 ([bda9bea](https://github.com/VenusProtocol/protocol-reserve/commit/bda9beafafb6845d786a7f01856788abd2cf34b7))
* ven-2007 n-09 ([78150be](https://github.com/VenusProtocol/protocol-reserve/commit/78150be539488543d7fcc726e29030bf443a6412))
* ven-2007 n-10 ([3876d3b](https://github.com/VenusProtocol/protocol-reserve/commit/3876d3b6729b843602ca254b68aa94d96775fcc5))
* VPB-01 ([ade9bda](https://github.com/VenusProtocol/protocol-reserve/commit/ade9bdaa9e2b9b91bd8a6613a028c197fb60c799))
* VPB-03 ([17a377c](https://github.com/VenusProtocol/protocol-reserve/commit/17a377cea76a320d3cf1ec0552ecdce494203566))
* VPB-04 ([ecc0c21](https://github.com/VenusProtocol/protocol-reserve/commit/ecc0c216d455064320b8ae8755591a0668789ff8))
* VPB-05 ([2848374](https://github.com/VenusProtocol/protocol-reserve/commit/2848374ac70572f97af3a3b10b063711d77500cb))
* VPB-06 ([b04357d](https://github.com/VenusProtocol/protocol-reserve/commit/b04357db49b2fe81194c3df874ffb229de7dbbf1))
* VPB-09 ([9145119](https://github.com/VenusProtocol/protocol-reserve/commit/9145119fac5cf60b08e1cc5abbe364167b485458))
* VPB-10 ([df2eeb4](https://github.com/VenusProtocol/protocol-reserve/commit/df2eeb4c782abfebd92aae1334734d646a5e5c21))
* VPB-12 ([20cd1b1](https://github.com/VenusProtocol/protocol-reserve/commit/20cd1b15c8e0272b3d7c2d6433a6390ca98c368d))
* VPB-13 ([b8e3e7b](https://github.com/VenusProtocol/protocol-reserve/commit/b8e3e7b5069103c005a7215598cd0ec04f306a51))
* VPB-14 ([e991342](https://github.com/VenusProtocol/protocol-reserve/commit/e99134211022180b0ca7c2f4b317ddb03d159487))

## [1.4.0-dev.3](https://github.com/VenusProtocol/protocol-reserve/compare/v1.4.0-dev.2...v1.4.0-dev.3) (2024-01-25)


### Features

* deployment files for riskFundV2 ([9aa4058](https://github.com/VenusProtocol/protocol-reserve/commit/9aa4058f4e369c86d8b2aa232ab97d4c2e67297b))
* updating deployment files ([6d6ef46](https://github.com/VenusProtocol/protocol-reserve/commit/6d6ef46924918558534c5c09aded1184cbda6bae))

## [1.4.0-dev.2](https://github.com/VenusProtocol/protocol-reserve/compare/v1.4.0-dev.1...v1.4.0-dev.2) (2024-01-24)


### Bug Fixes

* update yarn.lock ([fd5a56d](https://github.com/VenusProtocol/protocol-reserve/commit/fd5a56d2dbc2be4944c9037e4846a6fe7a4c6243))
* use ex6 modules ([0293c92](https://github.com/VenusProtocol/protocol-reserve/commit/0293c92ce81b1faf360703cf350203569f4bfd21))

## [1.4.0-dev.1](https://github.com/VenusProtocol/protocol-reserve/compare/v1.3.0...v1.4.0-dev.1) (2024-01-24)


### Features

* absract token transformer ([848271f](https://github.com/VenusProtocol/protocol-reserve/commit/848271f52d369766c2cde4f0e6b5184c6fbccd5f))
* add conversion config method for setting configs in batch ([baf6dfb](https://github.com/VenusProtocol/protocol-reserve/commit/baf6dfb49f8549699fb8d47eebd9baa1d28736da))
* add deployment files for bsc mainnet ([2abea71](https://github.com/VenusProtocol/protocol-reserve/commit/2abea7175c458539990d48229e692a90bda73be6))
* add deployment scripts for converters, ConverterNetwork and XVSVaultTreasury ([6286a0a](https://github.com/VenusProtocol/protocol-reserve/commit/6286a0ad51a62e3f19049f69dc117ec247961500))
* add getters for getAmountIn and getAmountOut ([26e3828](https://github.com/VenusProtocol/protocol-reserve/commit/26e3828da3381154eec514947c48ff23a7897b88))
* added ConverterNetwork contract and tests ([188562d](https://github.com/VenusProtocol/protocol-reserve/commit/188562d406c8bff38834a9b4adec5dcef361fb16))
* added private conversion functionality ([268a107](https://github.com/VenusProtocol/protocol-reserve/commit/268a1077886ed77ccd7ba1327d09829bf5bb672c))
* added setter for the direct transfer assets for riskfund ([46cd2cb](https://github.com/VenusProtocol/protocol-reserve/commit/46cd2cb1f80467a74f73cd78b00c5e61d729078a))
* risk fund contract ([08d449b](https://github.com/VenusProtocol/protocol-reserve/commit/08d449bdc7efdc99a59bc819725a9b51c0fb78be))
* support for native wrapped token ([1a41ef5](https://github.com/VenusProtocol/protocol-reserve/commit/1a41ef5c8209773aa381ce60479517a5f2253a69))
* sweep token for pools ([768a392](https://github.com/VenusProtocol/protocol-reserve/commit/768a392741df7cf67c9adcde3bdae31f18f84f0c))
* updating deployment files ([7f148a9](https://github.com/VenusProtocol/protocol-reserve/commit/7f148a97a80073c86dec165cabd9628ff1f877a5))
* updating deployment files ([45481a3](https://github.com/VenusProtocol/protocol-reserve/commit/45481a3909ef3d20c4b3a957a187f9b4c492db8e))
* updating deployment files ([13813be](https://github.com/VenusProtocol/protocol-reserve/commit/13813befcb96762423d58849e741438e722d34a3))
* updating deployment files ([34ca45a](https://github.com/VenusProtocol/protocol-reserve/commit/34ca45a6b2645a1c9758cabafe5aae4916ea9664))
* ven-1471 risk fund transformer ([89c4bf8](https://github.com/VenusProtocol/protocol-reserve/commit/89c4bf8eb29611893d73d2ed7f8bc12574f64e9d))
* ven-1472 xvs vault transformer ([8319971](https://github.com/VenusProtocol/protocol-reserve/commit/83199710d15a6e9e76256c6a0694343308eb52cf))
* ven-1473 xvs vault treasury ([cf8f101](https://github.com/VenusProtocol/protocol-reserve/commit/cf8f1014fdd9cdf26bb4bcfa2c4cdcbde8d1fb17))
* ven-1827 added core pool in risk fund converter ([57dceb0](https://github.com/VenusProtocol/protocol-reserve/commit/57dceb01b790868312c33c3aa800f0a9a7285bc9))
* ven-1828 added sweep token in risk fund ([91bbfbb](https://github.com/VenusProtocol/protocol-reserve/commit/91bbfbb17afb620acf89852a3d955e72435dc9cf))
* ven-1834 functionality for multiple assets in risk fund ([bbaf19a](https://github.com/VenusProtocol/protocol-reserve/commit/bbaf19a75ffecb173141ec8a3d659977968e9d0b))
* ven-1883 deployment script for riskFundConverter ([aee3c6c](https://github.com/VenusProtocol/protocol-reserve/commit/aee3c6c47c0805fd030abb52e9388228b67567de))


### Bug Fixes

* add reentrancy guard to getPoolAssetReserve function ([72e1b37](https://github.com/VenusProtocol/protocol-reserve/commit/72e1b37676587dbcb0e8ea1502081c9646d52f3b))
* added miannet addresses in the convertor script ([5d1c6b3](https://github.com/VenusProtocol/protocol-reserve/commit/5d1c6b3ff73e0f9934f07c1a24c257526d942c93))
* ATC-01 ([f76345d](https://github.com/VenusProtocol/protocol-reserve/commit/f76345d1780e82e91ae138a3cdbdf9b38fbfa3ff))
* ATC-03 ([a5caf65](https://github.com/VenusProtocol/protocol-reserve/commit/a5caf65aac3a12962c7f363c0a8c1af342abd9a0))
* ATC-04 ([1c558e8](https://github.com/VenusProtocol/protocol-reserve/commit/1c558e84934784f331940ffbc27f9efa294fe432))
* ATC-04 ([e37341c](https://github.com/VenusProtocol/protocol-reserve/commit/e37341ce91123454f7a0faecb81569d9141a5882))
* ATC-05 ([a71fe6f](https://github.com/VenusProtocol/protocol-reserve/commit/a71fe6fda9d41d7a3f4dbd430947bd5a6633e248))
* ATT-01 ([abe7ead](https://github.com/VenusProtocol/protocol-reserve/commit/abe7eadf62571ef4cd803f20c208390f6ff646c7))
* ATT-02 ([c8588a0](https://github.com/VenusProtocol/protocol-reserve/commit/c8588a01c5cef91e887aaedcbefef1405a58f3e6))
* ATT-02 ([11352cd](https://github.com/VenusProtocol/protocol-reserve/commit/11352cd7621b366100dc35ffcd1fe23de29d9478))
* CNC-02 ([f52d56a](https://github.com/VenusProtocol/protocol-reserve/commit/f52d56a08e482f63d204320354a60dff1024245e))
* CNC-04 ([2ba7503](https://github.com/VenusProtocol/protocol-reserve/commit/2ba750391140832648f374fe4d1e570173330942))
* convertForExactTokens bug regarding deflationary token ([5088e0f](https://github.com/VenusProtocol/protocol-reserve/commit/5088e0f86c8a23a6234ab10ced21517ab7ef1f01))
* deployment scripts and updated deployment files ([5468dc9](https://github.com/VenusProtocol/protocol-reserve/commit/5468dc9774aa318563f7ddd8cefede4c8542be09))
* fork tests for risk fund converter ([255e01a](https://github.com/VenusProtocol/protocol-reserve/commit/255e01a07b0f07de0ce8f328909ff97d3349227c))
* gas optimization for riskfundv2 ([cbb1651](https://github.com/VenusProtocol/protocol-reserve/commit/cbb16515857745443aa10f8be0a8b650b79af6df))
* get amount method ([3b21bc7](https://github.com/VenusProtocol/protocol-reserve/commit/3b21bc733d38490866dc609bf7769495615319c5))
* L-01 ([52eb722](https://github.com/VenusProtocol/protocol-reserve/commit/52eb7225bcbe030b6568c1a0d35becbdd082530c))
* L-02 ([6b6e9e4](https://github.com/VenusProtocol/protocol-reserve/commit/6b6e9e4e0bc557afec42402fc26ccee9641b0826))
* L-03 ([6bd7f9a](https://github.com/VenusProtocol/protocol-reserve/commit/6bd7f9ae7d86d361b2bd02083dac60441d869f8c))
* L-04 ([f3e40c3](https://github.com/VenusProtocol/protocol-reserve/commit/f3e40c3a240593a5f7ee0c392b6f92fa8d67a7c3))
* lint issues ([3743f49](https://github.com/VenusProtocol/protocol-reserve/commit/3743f49d53f4cab488f941ac4fb54b4b58e219f5))
* make comptroller and vBNB immutable ([6871238](https://github.com/VenusProtocol/protocol-reserve/commit/687123893ace5662bdfd3f976cb9eeaa71130a42))
* merge conflicts ([5e6aa8b](https://github.com/VenusProtocol/protocol-reserve/commit/5e6aa8b4d8a8da169cf7aa8ccb3d529bcc6856cc))
* minor fixes ([166d40b](https://github.com/VenusProtocol/protocol-reserve/commit/166d40be0cca5145afb982f39ebdc5d2580568d5))
* minor fixes ([7c18feb](https://github.com/VenusProtocol/protocol-reserve/commit/7c18feb0875f273090602aff5a03c63407334920))
* N-01 ([1af57c2](https://github.com/VenusProtocol/protocol-reserve/commit/1af57c2102159f275986a45e45e2d05c3134a943))
* N-02 ([b1244b3](https://github.com/VenusProtocol/protocol-reserve/commit/b1244b36d963b4762fa2b6ee0c1e139296e1e903))
* N-03 ([9994f12](https://github.com/VenusProtocol/protocol-reserve/commit/9994f12981204e0716f45c27c5213a3086f576ee))
* N-04 ([af3d4fc](https://github.com/VenusProtocol/protocol-reserve/commit/af3d4fcad648b06813358ca70f754d519d749d18))
* N-05 ([22a231a](https://github.com/VenusProtocol/protocol-reserve/commit/22a231a407c4da015115e17fb7b2f1ca481b9604))
* N-05 ([ae9e07b](https://github.com/VenusProtocol/protocol-reserve/commit/ae9e07b90a37d9d5c7f7db48e890a3c5b1c19585))
* N-06 ([84cbf18](https://github.com/VenusProtocol/protocol-reserve/commit/84cbf18db1f4a1d6dddf4f18ae6abb0d9fdddee5))
* N-07 ([a265d02](https://github.com/VenusProtocol/protocol-reserve/commit/a265d025bf6595f76a0cf8822c191f97a1be37cb))
* n1 ([7fd547e](https://github.com/VenusProtocol/protocol-reserve/commit/7fd547e6f9d589a73d1baf08fccd4ebbd776e9a9))
* n2 ([2d18458](https://github.com/VenusProtocol/protocol-reserve/commit/2d1845833a78f2da55eb8ae2c13605264e1b1c22))
* n3 ([624b0f1](https://github.com/VenusProtocol/protocol-reserve/commit/624b0f1f1f9d1e5a919a03ec7573bb1ae89f2f6e))
* post conversion hook bug ([15c252d](https://github.com/VenusProtocol/protocol-reserve/commit/15c252d637ad600d0d0017c7be54f2ff3b40ed13))
* postConversionHook error ([14d56fb](https://github.com/VenusProtocol/protocol-reserve/commit/14d56fb000c379c43b7418e2e15be61b2d5499cc))
* pr comments ([2339328](https://github.com/VenusProtocol/protocol-reserve/commit/2339328efb9571e2be2f7b09fd0fd6aad0798f07))
* pr comments ([8ef869a](https://github.com/VenusProtocol/protocol-reserve/commit/8ef869acea87739304b75a35b79cacc152133db7))
* pr comments ([554d804](https://github.com/VenusProtocol/protocol-reserve/commit/554d804df86900e232a5055e1ca3c85a9f0d169e))
* pr comments ([8d8f8c7](https://github.com/VenusProtocol/protocol-reserve/commit/8d8f8c786e598bf59b0d90edda59f8df16be84af))
* pr comments ([b176ddb](https://github.com/VenusProtocol/protocol-reserve/commit/b176ddb864628c56f5eee1bd58d6f165b8ab7a1a))
* pr comments ([23d4e99](https://github.com/VenusProtocol/protocol-reserve/commit/23d4e99719b57b939b75a731f48387b875722b5e))
* pr comments ([176a6f5](https://github.com/VenusProtocol/protocol-reserve/commit/176a6f50647191cdb86b58ccf77377d373a194c9))
* pr comments ([dc70688](https://github.com/VenusProtocol/protocol-reserve/commit/dc70688315616cba35501068d08ae8698994c904))
* pr comments ([a0d3f2a](https://github.com/VenusProtocol/protocol-reserve/commit/a0d3f2ad5fd685b55c692545beb29c387059bc87))
* pr comments ([3d64345](https://github.com/VenusProtocol/protocol-reserve/commit/3d64345e4d1d8ccf397b2c4439b5cfc2d34968bc))
* pr comments ([81bfa06](https://github.com/VenusProtocol/protocol-reserve/commit/81bfa06e88d4fe8f04efef8f5aaff02545531f6e))
* pr comments ([ecbb1ab](https://github.com/VenusProtocol/protocol-reserve/commit/ecbb1abe333e9b0b7ff5f130b7de9e6624fd2d95))
* pve-001 ([a1e6697](https://github.com/VenusProtocol/protocol-reserve/commit/a1e669790f14bf13d828d0f8f37f9beff37840b1))
* pve-002 ([fd20124](https://github.com/VenusProtocol/protocol-reserve/commit/fd201247db8c1e4ee6b6dcbdf3ee37ff05f0b23e))
* pve-003 ([92342eb](https://github.com/VenusProtocol/protocol-reserve/commit/92342eb81d4436cc0fa9a88d92b07615bebee562))
* pve-003-2 ([057dcee](https://github.com/VenusProtocol/protocol-reserve/commit/057dceef0ef5b762d349864b6572eb26f1620bd9))
* pve-005 ([74f9cb2](https://github.com/VenusProtocol/protocol-reserve/commit/74f9cb292fd8ecd53fcb37755047ae376a76dfa9))
* resolve comments ([3e60089](https://github.com/VenusProtocol/protocol-reserve/commit/3e600898ea8522c50f1b1361e378866889de9f41))
* resolved conflicts ([e5ad0df](https://github.com/VenusProtocol/protocol-reserve/commit/e5ad0dffc7ef7b99d57cb9fe8947c9655c6cadc3))
* resolved merge conflicts ([23662c0](https://github.com/VenusProtocol/protocol-reserve/commit/23662c06569d65af2e79035883f46fa296404b84))
* resolved merge conflicts ([cd353bd](https://github.com/VenusProtocol/protocol-reserve/commit/cd353bdae259bdbbe06e6eb017191b2ef1d9d437))
* resolved merge conflicts ([cdf4466](https://github.com/VenusProtocol/protocol-reserve/commit/cdf4466db03ef96876d0481b51366f0da9337aff))
* RFC-02 ([06914bd](https://github.com/VenusProtocol/protocol-reserve/commit/06914bd575affe5ce719797d6b53590ad44651db))
* RFC-04 ([83e5e1b](https://github.com/VenusProtocol/protocol-reserve/commit/83e5e1b2dc0e3ee445c410a7e3ae0588b835b6f1))
* RFV-03 ([cf5e371](https://github.com/VenusProtocol/protocol-reserve/commit/cf5e3713edb5c4a4f574881cb9f82d375625237e))
* RFV-06 ([42e67b7](https://github.com/VenusProtocol/protocol-reserve/commit/42e67b7189c3f243a3ec8667bd08761d53a4eebe))
* TCP-03 ([f4c8d1e](https://github.com/VenusProtocol/protocol-reserve/commit/f4c8d1e179c71a5cc10e9970ee45b4771e95c801))
* TCP-04 ([f8a8179](https://github.com/VenusProtocol/protocol-reserve/commit/f8a8179d23d378262a4213708731d0594dfa591f))
* TCP-05 ([cdd9e14](https://github.com/VenusProtocol/protocol-reserve/commit/cdd9e14e670829ae70515ee7b5c6a39b20790314))
* TCP-06 ([73bc544](https://github.com/VenusProtocol/protocol-reserve/commit/73bc544ef7cbcdc7e017001ec5de9e2a3d654ecd))
* TCV-01 ([9f579b1](https://github.com/VenusProtocol/protocol-reserve/commit/9f579b1ba0498ba74bc9e0acb007d22d8fbf9ca5))
* updatedsolidity-coverage depedency package ([caf7c41](https://github.com/VenusProtocol/protocol-reserve/commit/caf7c41c0bed5202272f63ac4d3144ba4e9b5a7f))
* ven-2007 l-02 ([0f58716](https://github.com/VenusProtocol/protocol-reserve/commit/0f587168094fc6682671f56ef8a92e26c677641b))
* ven-2007 l-03 ([a842667](https://github.com/VenusProtocol/protocol-reserve/commit/a8426677df622b6c59b62196eecf8d168f0ff2f8))
* ven-2007 l-04 ([a555053](https://github.com/VenusProtocol/protocol-reserve/commit/a555053d6a7d41e0389e5c01deffab985a392a30))
* ven-2007 l-05 ([35dc0a1](https://github.com/VenusProtocol/protocol-reserve/commit/35dc0a1211094458b2db4552ab07694001c6d6df))
* ven-2007 l-06 ([e558b15](https://github.com/VenusProtocol/protocol-reserve/commit/e558b1568840434b748582f4a3371c3bebec8a51))
* ven-2007 l-08 ([2be108d](https://github.com/VenusProtocol/protocol-reserve/commit/2be108d71b36897874e587033ceb5fd52ef90185))
* ven-2007 m-01 ([4025db0](https://github.com/VenusProtocol/protocol-reserve/commit/4025db080dbf0d9f19b38109e9da6f5e72cc9353))
* ven-2007 m-02 ([939da0a](https://github.com/VenusProtocol/protocol-reserve/commit/939da0aa86b65a98e59c56e5ddb03391c6f71fa7))
* ven-2007 n-01 ([5d0f03b](https://github.com/VenusProtocol/protocol-reserve/commit/5d0f03bd50771bfd77b139697f1c803b868a8549))
* ven-2007 n-02 ([91eb7a6](https://github.com/VenusProtocol/protocol-reserve/commit/91eb7a6f3aa8473b2724827c724efcb1ee6aaf3a))
* ven-2007 n-03 ([1e367e1](https://github.com/VenusProtocol/protocol-reserve/commit/1e367e1ebea6fffe91632b1586816cec8d8f1f3b))
* ven-2007 n-04 ([8d6389c](https://github.com/VenusProtocol/protocol-reserve/commit/8d6389c76606e02be64b833e0581d9d9defa8737))
* ven-2007 n-06 ([8227f4b](https://github.com/VenusProtocol/protocol-reserve/commit/8227f4babf156f79ffe8ce48461535055648cf5e))
* ven-2007 n-07 ([08bacb3](https://github.com/VenusProtocol/protocol-reserve/commit/08bacb307fa4dd63305982792726638a8ba03ff3))
* ven-2007 n-08 ([bda9bea](https://github.com/VenusProtocol/protocol-reserve/commit/bda9beafafb6845d786a7f01856788abd2cf34b7))
* ven-2007 n-09 ([78150be](https://github.com/VenusProtocol/protocol-reserve/commit/78150be539488543d7fcc726e29030bf443a6412))
* ven-2007 n-10 ([3876d3b](https://github.com/VenusProtocol/protocol-reserve/commit/3876d3b6729b843602ca254b68aa94d96775fcc5))
* VPB-01 ([ade9bda](https://github.com/VenusProtocol/protocol-reserve/commit/ade9bdaa9e2b9b91bd8a6613a028c197fb60c799))
* VPB-03 ([17a377c](https://github.com/VenusProtocol/protocol-reserve/commit/17a377cea76a320d3cf1ec0552ecdce494203566))
* VPB-04 ([ecc0c21](https://github.com/VenusProtocol/protocol-reserve/commit/ecc0c216d455064320b8ae8755591a0668789ff8))
* VPB-05 ([2848374](https://github.com/VenusProtocol/protocol-reserve/commit/2848374ac70572f97af3a3b10b063711d77500cb))
* VPB-06 ([b04357d](https://github.com/VenusProtocol/protocol-reserve/commit/b04357db49b2fe81194c3df874ffb229de7dbbf1))
* VPB-09 ([9145119](https://github.com/VenusProtocol/protocol-reserve/commit/9145119fac5cf60b08e1cc5abbe364167b485458))
* VPB-10 ([df2eeb4](https://github.com/VenusProtocol/protocol-reserve/commit/df2eeb4c782abfebd92aae1334734d646a5e5c21))
* VPB-12 ([20cd1b1](https://github.com/VenusProtocol/protocol-reserve/commit/20cd1b15c8e0272b3d7c2d6433a6390ca98c368d))
* VPB-13 ([b8e3e7b](https://github.com/VenusProtocol/protocol-reserve/commit/b8e3e7b5069103c005a7215598cd0ec04f306a51))
* VPB-14 ([e991342](https://github.com/VenusProtocol/protocol-reserve/commit/e99134211022180b0ca7c2f4b317ddb03d159487))

## [1.3.0](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0...v1.3.0) (2024-01-23)


### Features

* add PSR deployments of opbnbtestnet ([ea28049](https://github.com/VenusProtocol/protocol-reserve/commit/ea2804990da19e5c200a40cf590d03d1bf9d4bbb))
* update dependencies ([5462ca9](https://github.com/VenusProtocol/protocol-reserve/commit/5462ca98577100cf6c0f286c36b29db63ddf7c3b))
* update deps to the stable versions ([7afc729](https://github.com/VenusProtocol/protocol-reserve/commit/7afc7298c994d89a8178a7fb11f69054c0670cba))
* updating deployment files ([e6348b7](https://github.com/VenusProtocol/protocol-reserve/commit/e6348b72a8c9b2ff81b10a17660d8ce49e34ef08))
* updating deployment files ([b28f9ca](https://github.com/VenusProtocol/protocol-reserve/commit/b28f9ca99f626a7d09fe93255f8d906ad29264db))
* updating deployment files ([80226d8](https://github.com/VenusProtocol/protocol-reserve/commit/80226d8b95d03b1ee3c925718fd8666afa29790a))

## [1.3.0-dev.3](https://github.com/VenusProtocol/protocol-reserve/compare/v1.3.0-dev.2...v1.3.0-dev.3) (2024-01-23)


### Features

* update deps to the stable versions ([7afc729](https://github.com/VenusProtocol/protocol-reserve/commit/7afc7298c994d89a8178a7fb11f69054c0670cba))

## [1.3.0-dev.2](https://github.com/VenusProtocol/protocol-reserve/compare/v1.3.0-dev.1...v1.3.0-dev.2) (2024-01-16)


### Features

* add PSR deployments of opbnbtestnet ([ea28049](https://github.com/VenusProtocol/protocol-reserve/commit/ea2804990da19e5c200a40cf590d03d1bf9d4bbb))

## [1.3.0-dev.1](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0...v1.3.0-dev.1) (2024-01-03)


### Features

* update dependencies ([5462ca9](https://github.com/VenusProtocol/protocol-reserve/commit/5462ca98577100cf6c0f286c36b29db63ddf7c3b))
* updating deployment files ([e6348b7](https://github.com/VenusProtocol/protocol-reserve/commit/e6348b72a8c9b2ff81b10a17660d8ce49e34ef08))
* updating deployment files ([b28f9ca](https://github.com/VenusProtocol/protocol-reserve/commit/b28f9ca99f626a7d09fe93255f8d906ad29264db))
* updating deployment files ([80226d8](https://github.com/VenusProtocol/protocol-reserve/commit/80226d8b95d03b1ee3c925718fd8666afa29790a))

## [1.2.0](https://github.com/VenusProtocol/protocol-reserve/compare/v1.1.0...v1.2.0) (2023-12-27)


### Features

* add github job to export and commit deployment by network ([475fe58](https://github.com/VenusProtocol/protocol-reserve/commit/475fe5845aca75b9f47a11ada68f2090d4a45bb6))
* build and package typescript deployment files ([2361ca0](https://github.com/VenusProtocol/protocol-reserve/commit/2361ca09c7b7ca015ad2d5295fad34a7fd68c38b))
* build and package typescript deployment files ([70ea3f9](https://github.com/VenusProtocol/protocol-reserve/commit/70ea3f9c32d8fb6f8a519027c9118ec520b366bc))
* generate file only with addresses of deployed contracts ([0858c7e](https://github.com/VenusProtocol/protocol-reserve/commit/0858c7e0c6949798e45234b5ae301581bd5caaa2))
* generate file only with addresses of deployed contracts ([063d8d2](https://github.com/VenusProtocol/protocol-reserve/commit/063d8d2dd5405330f30b523bd56829be074fef9e))
* updating deployment files ([4d69337](https://github.com/VenusProtocol/protocol-reserve/commit/4d69337e4a36e80d7bf95d2cfa4a4b667fe5a49d))
* updating deployment files ([4027513](https://github.com/VenusProtocol/protocol-reserve/commit/402751354f9c7d900560fe3627f1ba3b27b03592))
* updating deployment files ([b9c516c](https://github.com/VenusProtocol/protocol-reserve/commit/b9c516cf3d0f4405f2412d6dc80f2d9e21454043))
* updating deployment files ([11c43ae](https://github.com/VenusProtocol/protocol-reserve/commit/11c43aea6728ee865494d2d379022202afa4b05b))
* updating deployment files ([c295957](https://github.com/VenusProtocol/protocol-reserve/commit/c295957d7ae1471124d4a131045c235fc93aae2b))
* updating deployment files ([d6d9557](https://github.com/VenusProtocol/protocol-reserve/commit/d6d9557c01173350d29b7c10fe6020935f776d48))
* updating deployment files ([c2a2296](https://github.com/VenusProtocol/protocol-reserve/commit/c2a2296d8e81299c5ffad64b3060f6a7a809b8b8))
* updating deployment files ([94151cd](https://github.com/VenusProtocol/protocol-reserve/commit/94151cd6d0ea37b6765833c767392bcbbd687e43))


### Bug Fixes

* add coverage report ([1ebdf3d](https://github.com/VenusProtocol/protocol-reserve/commit/1ebdf3d37d42db35c95fb17880f972ec7ff99cdd))
* added cobertura report ([70ed511](https://github.com/VenusProtocol/protocol-reserve/commit/70ed511ec928935450d6c30fce5d1625f649c6a3))
* added types ([ac83c2c](https://github.com/VenusProtocol/protocol-reserve/commit/ac83c2c718762d8faf3ebc75a6ff3c4587acac4b))
* exclude external deployments when exporting ([da32649](https://github.com/VenusProtocol/protocol-reserve/commit/da32649a69c4b9eebcb8b563b94ea694c993efa3))
* fix build with missing type ([1c71743](https://github.com/VenusProtocol/protocol-reserve/commit/1c71743f918ffd6f0d697fab0aef7609665d42c4))
* fixed compile and lint issues ([41cdc93](https://github.com/VenusProtocol/protocol-reserve/commit/41cdc938fc2ef079169ca93ced621b90e6b28824))
* fixed compile and lint issues ([77de73a](https://github.com/VenusProtocol/protocol-reserve/commit/77de73a37e50eb3b25cb57d0981bc90d31940a58))
* fixed lint ([dbf1864](https://github.com/VenusProtocol/protocol-reserve/commit/dbf1864819bf4c04eb66d21aba27922dc227a594))
* fixed lint ([f269468](https://github.com/VenusProtocol/protocol-reserve/commit/f26946885c46bcf100a0f3922effd71f11bcb56b))
* fixed proxy address ([de9df20](https://github.com/VenusProtocol/protocol-reserve/commit/de9df206c4d2ba903e50dd6f553bc16ab8241e3a))
* max percent in psr ([0914d83](https://github.com/VenusProtocol/protocol-reserve/commit/0914d83a70807138a395110dbf30934c7b6eb12b))
* remove compiler version 0.5.16 ([cdb9c51](https://github.com/VenusProtocol/protocol-reserve/commit/cdb9c5120af9436646647276d4fc29e2e471041d))
* remove exports from package.json ([747eabf](https://github.com/VenusProtocol/protocol-reserve/commit/747eabf1d2ec34137d26ecb8063f9b8c3fff11e5))
* remove exports from package.json ([e61df95](https://github.com/VenusProtocol/protocol-reserve/commit/e61df958c0bb272b72cb634c6e09cbcba6cbc548))
* removed path and fixed lint ([753b565](https://github.com/VenusProtocol/protocol-reserve/commit/753b565822b4d1c6c06bc14da5a14d8d98afc518))
* removed report formats ([88ece40](https://github.com/VenusProtocol/protocol-reserve/commit/88ece407529d703139cfd8b8ae51e52c1752e730))
* resolved conflict ([a4efd48](https://github.com/VenusProtocol/protocol-reserve/commit/a4efd48e0f0cf0c478aade1857dd40e591db2bce))
* revert DefaultProxyAdmin addr ([89b916a](https://github.com/VenusProtocol/protocol-reserve/commit/89b916a95701621148ab0cc3cc567b1499989068))
* unify the use of the env variable DEPLOYER_PRIVATE_KEY ([e766787](https://github.com/VenusProtocol/protocol-reserve/commit/e7667879c9a9a8dc1cfd8060ebcc0864ccdacd87))
* unify the use of the env variable DEPLOYER_PRIVATE_KEY ([59ee4ad](https://github.com/VenusProtocol/protocol-reserve/commit/59ee4ad49f8b950fb36a1da307431dc11aa980c8))
* use imported address and change export ([9aa8473](https://github.com/VenusProtocol/protocol-reserve/commit/9aa8473193f0398a2abe208fa55d13308ca49739))

## [1.2.0-dev.7](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.6...v1.2.0-dev.7) (2023-12-22)


### Bug Fixes

* remove compiler version 0.5.16 ([cdb9c51](https://github.com/VenusProtocol/protocol-reserve/commit/cdb9c5120af9436646647276d4fc29e2e471041d))

## [1.2.0-dev.6](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.5...v1.2.0-dev.6) (2023-12-12)


### Features

* build and package typescript deployment files ([2361ca0](https://github.com/VenusProtocol/protocol-reserve/commit/2361ca09c7b7ca015ad2d5295fad34a7fd68c38b))
* generate file only with addresses of deployed contracts ([0858c7e](https://github.com/VenusProtocol/protocol-reserve/commit/0858c7e0c6949798e45234b5ae301581bd5caaa2))
* updating deployment files ([4d69337](https://github.com/VenusProtocol/protocol-reserve/commit/4d69337e4a36e80d7bf95d2cfa4a4b667fe5a49d))
* updating deployment files ([4027513](https://github.com/VenusProtocol/protocol-reserve/commit/402751354f9c7d900560fe3627f1ba3b27b03592))
* updating deployment files ([b9c516c](https://github.com/VenusProtocol/protocol-reserve/commit/b9c516cf3d0f4405f2412d6dc80f2d9e21454043))
* updating deployment files ([11c43ae](https://github.com/VenusProtocol/protocol-reserve/commit/11c43aea6728ee865494d2d379022202afa4b05b))
* updating deployment files ([c295957](https://github.com/VenusProtocol/protocol-reserve/commit/c295957d7ae1471124d4a131045c235fc93aae2b))
* updating deployment files ([d6d9557](https://github.com/VenusProtocol/protocol-reserve/commit/d6d9557c01173350d29b7c10fe6020935f776d48))


### Bug Fixes

* add coverage report ([1ebdf3d](https://github.com/VenusProtocol/protocol-reserve/commit/1ebdf3d37d42db35c95fb17880f972ec7ff99cdd))
* added cobertura report ([70ed511](https://github.com/VenusProtocol/protocol-reserve/commit/70ed511ec928935450d6c30fce5d1625f649c6a3))
* added types ([ac83c2c](https://github.com/VenusProtocol/protocol-reserve/commit/ac83c2c718762d8faf3ebc75a6ff3c4587acac4b))
* exclude external deployments when exporting ([da32649](https://github.com/VenusProtocol/protocol-reserve/commit/da32649a69c4b9eebcb8b563b94ea694c993efa3))
* fix build with missing type ([1c71743](https://github.com/VenusProtocol/protocol-reserve/commit/1c71743f918ffd6f0d697fab0aef7609665d42c4))
* fixed compile and lint issues ([41cdc93](https://github.com/VenusProtocol/protocol-reserve/commit/41cdc938fc2ef079169ca93ced621b90e6b28824))
* fixed compile and lint issues ([77de73a](https://github.com/VenusProtocol/protocol-reserve/commit/77de73a37e50eb3b25cb57d0981bc90d31940a58))
* fixed lint ([dbf1864](https://github.com/VenusProtocol/protocol-reserve/commit/dbf1864819bf4c04eb66d21aba27922dc227a594))
* fixed lint ([f269468](https://github.com/VenusProtocol/protocol-reserve/commit/f26946885c46bcf100a0f3922effd71f11bcb56b))
* fixed proxy address ([de9df20](https://github.com/VenusProtocol/protocol-reserve/commit/de9df206c4d2ba903e50dd6f553bc16ab8241e3a))
* remove exports from package.json ([747eabf](https://github.com/VenusProtocol/protocol-reserve/commit/747eabf1d2ec34137d26ecb8063f9b8c3fff11e5))
* removed path and fixed lint ([753b565](https://github.com/VenusProtocol/protocol-reserve/commit/753b565822b4d1c6c06bc14da5a14d8d98afc518))
* removed report formats ([88ece40](https://github.com/VenusProtocol/protocol-reserve/commit/88ece407529d703139cfd8b8ae51e52c1752e730))
* resolved conflict ([a4efd48](https://github.com/VenusProtocol/protocol-reserve/commit/a4efd48e0f0cf0c478aade1857dd40e591db2bce))
* revert DefaultProxyAdmin addr ([89b916a](https://github.com/VenusProtocol/protocol-reserve/commit/89b916a95701621148ab0cc3cc567b1499989068))
* unify the use of the env variable DEPLOYER_PRIVATE_KEY ([e766787](https://github.com/VenusProtocol/protocol-reserve/commit/e7667879c9a9a8dc1cfd8060ebcc0864ccdacd87))
* use imported address and change export ([9aa8473](https://github.com/VenusProtocol/protocol-reserve/commit/9aa8473193f0398a2abe208fa55d13308ca49739))

## [1.2.0-dev.5](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.4...v1.2.0-dev.5) (2023-12-11)


### Bug Fixes

* max percent in psr ([0914d83](https://github.com/VenusProtocol/protocol-reserve/commit/0914d83a70807138a395110dbf30934c7b6eb12b))

## [1.2.0-dev.4](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.3...v1.2.0-dev.4) (2023-12-05)


### Features

* build and package typescript deployment files ([70ea3f9](https://github.com/VenusProtocol/protocol-reserve/commit/70ea3f9c32d8fb6f8a519027c9118ec520b366bc))

## [1.2.0-dev.3](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.2...v1.2.0-dev.3) (2023-12-01)


### Features

* generate file only with addresses of deployed contracts ([063d8d2](https://github.com/VenusProtocol/protocol-reserve/commit/063d8d2dd5405330f30b523bd56829be074fef9e))
* updating deployment files ([c2a2296](https://github.com/VenusProtocol/protocol-reserve/commit/c2a2296d8e81299c5ffad64b3060f6a7a809b8b8))


### Bug Fixes

* unify the use of the env variable DEPLOYER_PRIVATE_KEY ([59ee4ad](https://github.com/VenusProtocol/protocol-reserve/commit/59ee4ad49f8b950fb36a1da307431dc11aa980c8))

## [1.2.0-dev.2](https://github.com/VenusProtocol/protocol-reserve/compare/v1.2.0-dev.1...v1.2.0-dev.2) (2023-11-28)


### Bug Fixes

* remove exports from package.json ([e61df95](https://github.com/VenusProtocol/protocol-reserve/commit/e61df958c0bb272b72cb634c6e09cbcba6cbc548))

## [1.2.0-dev.1](https://github.com/VenusProtocol/protocol-reserve/compare/v1.1.0...v1.2.0-dev.1) (2023-11-17)


### Features

* add github job to export and commit deployment by network ([475fe58](https://github.com/VenusProtocol/protocol-reserve/commit/475fe5845aca75b9f47a11ada68f2090d4a45bb6))
* updating deployment files ([94151cd](https://github.com/VenusProtocol/protocol-reserve/commit/94151cd6d0ea37b6765833c767392bcbbd687e43))

## [1.1.0](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.0...v1.1.0) (2023-11-01)


### Features

* replace dependency of isolated-pools ([4eb584a](https://github.com/VenusProtocol/protocol-reserve/commit/4eb584abbe5d750134bf2f91d60a4e4de6298cbe))


### Bug Fixes

* remove duplicate directory ([cd3c32e](https://github.com/VenusProtocol/protocol-reserve/commit/cd3c32e17f91dbcee0aa40a096c9df008a50f00d))

## [1.1.0-dev.1](https://github.com/VenusProtocol/protocol-reserve/compare/v1.0.1-dev.1...v1.1.0-dev.1) (2023-10-25)


### Features

* replace dependency of isolated-pools ([4eb584a](https://github.com/VenusProtocol/protocol-reserve/commit/4eb584abbe5d750134bf2f91d60a4e4de6298cbe))

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
