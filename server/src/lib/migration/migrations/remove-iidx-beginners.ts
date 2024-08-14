import db from "external/mongo/db";
import { DeleteMultipleScores } from "lib/score-mutation/delete-scores";
import type { Migration } from "utils/types";

const migration: Migration = {
	id: "remove-iidx-beginners",
	up: async () => {
		// copied from seeds before they were removed
		// the charts themselves are not guaranteed to be in the db
		// so they have to be hardcoded.
		const beginners = [
			"71865a2b6d3581decf076ae83c6621302c4bb271",
			"fc143b488d1af894fdd0c5be145e1d613aaf5214",
			"5e7128485017b67e85cc75432326c9656a33f310",
			"5798dd1c2a16e6ef3e4469f7a2bdea8a7bc1cd8f",
			"dafa3f6511a3150015ffaaac3f4a008aacc0ebe1",
			"62c5cb9228f39e2d6d222ecf84aa709c5e2271ce",
			"e852f83964486ef81558b84dd4b554ffc9caf174",
			"963edf351b3c6f29c09c54e55ec2c3dd041340a9",
			"17514921a23abf2b76983cf50e79b3ff600763b1",
			"950c0181ee33d10d3af448c00657702d1a479b8c",
			"7e70836d0a3001aa7bd5e9488660f31746be60d8",
			"888259e7cc44e2bf2e032898f6a9e85cd4fcad1b",
			"02aea8a2135311a7a1f9404e6a12f138ecfae092",
			"87b65dbf2965949644c72515a202bb4363662b6b",
			"d1e92965be52b5e887089383e0a687d20098e5b4",
			"139d5851baf82d75731d9629a25fdee2b75d41c5",
			"d903739755a1de064e646280260f7dabe16fbc2e",
			"48ee9417cbc4ebad782d372d63548085f65ed660",
			"d8ee3c7e42227d9f660598508531e30a990bae39",
			"2a2406e6c5236448615f177eb5ac830c353bde12",
			"fa424066e32730fe29faad0b0d25aa6323ea6129",
			"b38485e92c09f6736ab7e1737c0ed7a191fcdba8",
			"241a27876b22646ccb85b6f53a61d7a46fc93168",
			"0f39a16ff18d509f44dcf4e37850269477475e77",
			"1a44bf2a27033a89af7dad853d846c7bba9f9a48",
			"c94536933f21c0ceb2f0b68b4b4bc35849f1d04b",
			"4dd7495c32b560f50ad54bec6753c010feb9381c",
			"46b18a37648c06bf480487c2b62f5caa8995281a",
			"2a9b158e5974fb2f8707843493099b7fc728a320",
			"db81c35d160fc5870f5957361a8b32add1bc318b",
			"d399af231b377289e1d575337a43609c17998e35",
			"e9ca3d286a330bb4ce29e89334c465c243af29c2",
			"794ae8f3b8b1b62d0ff9f32c890bd5ccb887d0a0",
			"c22c1a520f7dd87be4d1ba1c1ec59a4d572951ff",
			"55471eca15caaa14b6dd9f4eaa7bcede2b6f8e7b",
			"9f8deae94e16a9b075a8a5290a14df5bb1d349cc",
			"5716dddd0316b932fd8b3a9c530cd624c1c50bdf",
			"4eafaf1009423849c3709936e1a0b361a0c5e530",
			"3f4cda22aa09aad1959993570447e107b6d3cf4c",
			"b194cb8b2aa80189567a7bab0949d067792a9086",
			"498b6d1388ce9f9672ba038a6b4b02aae4c8cc4c",
			"24b4c560ee3daa9a286cca100246b3dc06e96cf0",
			"5770f819940914328b74fc7616b69562285eed11",
			"6b0831dbde8a52ae377be6aaddea37ec0771a49f",
			"2f92bf3627e07e836a5d68aa538f33b3563ed167",
			"75373c0c4d1dfef62de50bbb25085f729a20a72a",
			"0cca3d6b4361195e883c79017e9850bc767b4f22",
			"dcd047a218e17011c7ab340236af62be64893781",
			"d821202823731335567f32730bfed70d5bfd1368",
			"439bb68fc96706a86a98d437e4f03e032597bc7c",
			"79c7ad40e434a5bc0cb139c9e6e0ad06730e9ea1",
			"2d549a71666934fcf86d9d827c5f2f6959d49fa7",
			"ccb99f9d00ae04b7a0fd0754c9b3024ec527f718",
			"21bcddc1191acaf1911fc173d23eb81c939bbe2e",
			"10a78c2b7ecf9f5f9c3a11f2385977dc789fbb4e",
			"ec7d6764c543dccfbe097a014b6b8839000b76de",
			"be19c987cdc067369151829a9889bcae2799fe95",
			"b382c1cf9732e132b2fb7800d2d82a93b2497789",
			"c70cf629f97a2623d5cff716185350f85b07435a",
			"5a94628384b43f68cfee44df205bc0a3edbd1913",
			"1c964098d2954f4c8d2e7b723d77a2d1f79f7317",
			"a31d41fe3bfd21c0c6e71f8d6df4e556be329123",
			"b0b3e92576de8d9090472d118c424e08d1bdd826",
			"d667a2e1f226c09e2549393240e00878a8cc4edf",
			"e1dbe5d59d4a776ecbffeb0b165c715aae2995b1",
			"fb24f2688473c46c04d666d27a9210c871a8191f",
			"cb61bd200eea0936d5278b3b28e1033c36713341",
			"bcd1fc3e53e2c1c001079159a26767a07f8e628e",
			"871db812f3ee5002266edfe7b2cf48b4b2451302",
			"01b60f5125ef5123c3840943c047446d167f3e3e",
			"10f3292e7f1c91bb9c3e7d8c7b1b43fc8d9d929f",
			"6ab72d59a8967bb6265dc82c28ac054d1f86684d",
			"2ea729f82867a2c29d34c88ef0cde22358702b00",
			"7f5b5f3e3640e2848985b85a574dffbf95a37030",
			"7c78e67927f620c06d30887e29cc26683f3748f6",
			"b34d86e91d32590d39dcb62216d1a26ea6bdfbef",
			"be31fc23b03c53aa58a3a7b599a5b8b2e7ee2ede",
			"3f5b76fcb0e9db6146e2f216771250d89bcb6942",
			"0568ca6e19a3660b74bbf6fb97453d57b8bd0c83",
			"ff1d34af1db5a089505f84a9aa2407b95a64f29b",
			"0484e8f3ab6c6dae1311ff4f2980cf76b438aaf9",
			"66624f8162c7949744e84f3ef3abb314fcb2da8e",
			"531d5a70c4b02da03ee3be0d1efcffb78fe4ef43",
			"5df850385272324559182a07d6a2a6b84bbd32bf",
			"8ea6931b5382a6460e052410990f8e7c6d2fbcbc",
			"8c20bfdaa71322bd572f38c95ffe22b8e65a9fc7",
			"fcda03d3fb068fb58c4ae4234582d313ee22eb9d",
			"c030db51ec510815e28f0ba181a650de492d2bb5",
			"f865fcc658bce3ee89e19dac88486546eb4a5648",
			"4de8a44831d3d730d24a174a3c78fa4d17271b87",
			"1dfb262a9455e010e635989e480affaf61cd0113",
			"49ac835cf5e5cd96a095df0f7220f2532a8c3632",
			"3cb97b11313657f9f59cd1ce859c6c642e7a0afe",
			"a7286b7086f8e19d78c7cc3fe73249d752fe9fb4",
			"982d79f972da4e0a98c73d7d6709b931aa9940a6",
			"1757d3c8c1f2e5392ec8aa6adb31a5a85ce1754f",
			"c14ac167a2141d14609878cb8b5a0bacaab18468",
			"876c1d284d63b272725a33d83b061e8d187bd60d",
			"7d495aad1d8e07a499e30373b44e2e1257c21281",
			"aa87f48af5a7a658e3f518f07cf5a45ea6750d5e",
			"8c88175d419658c9f0ca1ac0994bbd40675027be",
			"f98896e0dcdf7994c2ed38f452b1bf3dadd345f8",
			"20941a1f2f707ce1a3587be135e42f453230f337",
			"dbece3e1d537f91b2d0a4bfbb6d1ce98cf08a20c",
			"25c2c3b947ff45795f1aeacf257a872dad8a65a5",
			"6e071685bb2aa43878945fad560c68ce8db7c57d",
			"88a1445681b2f70f0e84c30a66737dc942a42005",
			"c32334b6f121993235082be73afb8137d0c0da19",
			"5b49b8de2b70283e2364418ae50af0586a4373c2",
			"009aa903a4b9fac40138deb8c5162280a747ae66",
			"5b4bf383e44746468c21bf800eac0ef13e72d2f4",
			"8c8917854d96a23a40b844beca846f7211c26be6",
			"e73a369bbc639f8bfca9b00ec167c772300fcae2",
			"3fb05d8b7e68c340f0257c1c405e8a9c75d03119",
			"f4af6d0da9cc5f21b8dcb447bc79dcaec0d82965",
			"06acbead44e406c41e8827186850950096ffe6e5",
			"e6b480eba3d7aaca43f05fcc243cae558f846b72",
			"91076b64d7aae8f053a9cc1b6849fbefcde68717",
			"8536c1167ee235c1c9c07740af55ef45348bc0fb",
			"275e441a1589572ce76067e7db8a51755d6133b3",
			"d13ce9d0b458d2d77ee92957a68df649a4ee723a",
			"29f7e78c0b9062cb8b12b327253a6dd0358612e1",
			"fda142a18547351ad1085c7a82fc0546a5aeba57",
			"9b7367e990ab8251597dc85b9a8ffe46284881d0",
			"53978253c493013d7e5f6cb4161cba6691414fb2",
			"719b865582fe63cc16e4a376a28296853c19ec95",
			"f41c638800df3f5ed079ed64ba1cc692e6976c49",
			"c29c03903449bbe998640c7e9db74a76ec7fe06a",
			"675ebf4acb10bffce2bf11a5d058ee22a04efc17",
			"42fe786b7af412634ab8c2d939bad0d9dc29e38e",
			"e0ea98985e05cf5f806cf8215ad3a1ee15423451",
			"72c1a989bef60be4a8c1c62a3efe1e92233f6a7c",
			"772756db2182cfbca706ee62357ebd2539f81c16",
			"0493b956a14beca895b3f0b5e2d7e3471387ee63",
			"f7c14287e59c6cc41cd4f6296a51694b6a5c8249",
			"0e8875810b6b895b37e028a0f9a75ad14d17e28b",
			"61322a1d7dc669604c9a8621b60eeb887e60dbd6",
			"b83b48401a4352c533bfefde2f19b87815e88394",
			"9f99251bf88c0efecb6cbcc62d5cb64be4c82a9d",
			"507b2342d683a10cac317346fd5c743b129fb786",
			"f17367f08b15d4af2823534180b290128852fb6c",
			"738a4332f3aa8ef2c2ca698444621f7657c611cb",
			"03877a6ee4f639c8449065d6e35709b22e9224af",
			"e6b3645a8543654224140ac5854ab4584911b822",
			"99a6807e22830dabd3f3aa5631dda0fd38940220",
			"1af1a81e2ac30f5e21ac1eb39ebb970894c1db95",
			"b026831b99bcb0c4b259c3446f969d2e75978474",
			"204b94938a992ee3539324c70b922dd4b05d4156",
			"0b8722317353af3bbb28d8578b08c682a3a442aa",
			"ed8b651f6fbfbcb5bf258147d3bfe276f8e183bf",
			"daec5d11791b7e87c8a67968ce2cd9a066167f6e",
			"389e82aeebbe95519bf2957265f4e7126d90d27a",
			"e1b25bb9af0b24562b51cd857b9fadb697ec6a0b",
			"007d459a4ee5a2b29fdb5396d291a151b4915c58",
			"29aa55ecfa77f792166b12a8188a9d1468af66df",
			"519a1e30b9f563abb78654798be8304e55b1ef2c",
			"a0b67afb6b3335a81dfe400d2ebf32d7d83f1924",
			"edaa8463ac326baa34c99976c36f31a957e62190",
			"7ba5b22204cbcdeaab550a7e37a8744a7760dd9e",
			"34bdf077fcc2bbcc01cea8a2a7956dc988212815",
			"b0f7f654a1663d21eca4665f9f98912c655065b0",
			"81aa485038cec17ac15c3f39c8127cdb027e038c",
			"be9b86ac9a898efa539ad74ae3106a4dc82d5aa1",
			"868fa4e239b59a6eaeede9ea17fe15c466f018d5",
			"27270db6941d575ae94c028df1b21eec448fb9e9",
			"d7eaf8be7fafdd96f635954521c3e917fb9ad7c5",
			"7551c2a33656c3065755e66519d245efcc6f7330",
			"3625c061aaf90c384868b7f3745f7b77edc63b27",
			"f68fd5dda2bfe7e5c8bcb961918ca87b5c8d4347",
			"5d0ce8c1973e14aad82dd51c07fca8cdd5ad3dbb",
			"356c75587a1d45c1bb02aab987ac15350e3dc665",
			"cd84e01b39898103907e183b79b99d49da36fd50",
			"8f76cd178ef94b5784b6a8011a71870b17705a77",
			"9ee1128a70428a4ec7938173d6ba0f577d6b3069",
			"86639d28029e7c8eb0246db1de83fa9134fb9997",
			"c0aa7fcbc44e33a937bf21d761f9b5d348dc8cbe",
			"451714744633ac72d15922ad651deabc611d1db9",
			"42be14e5a7b8991d4e7be715dc43d3fce0326021",
			"e653ffb2f2ea14e1bcdedbfaa9b7780e009c3dad",
			"7962ec3bb553bf9103e7a186a02627a0f2086b8f",
			"0a89606183c4d5aea122d6406a5c3eb2be895ec8",
			"8f406d3aad3b5e1ac37486c71af86249f2f577c3",
			"9c1ae44ea3ec24e3bb3a60a68fa8d1211f6d1bf8",
			"27536e3ea51722536e236b916eb7d91c9ca98fa0",
			"281ddcbba655858fdd5a408ff8c4ae1ed24ce0f4",
			"0fcbce768b9f939b31c04132b00f18a27fc10fd3",
			"3d483bdced0dced981b810c6a48caa78ffe7253a",
			"a962cb8891965e5921b1f4910e99a36e688a9ac1",
			"038db5c9c451e3e36ac5a9e48912fbad87502731",
			"d376224b9c1ef9af6fee83ef01b2ee04c20319f5",
			"50b1a2eaf172613919159f92bfb3d457174495fd",
			"e710068ab927ee86ad0d1151531c2ae34b121321",
			"9b0da3ed3be75dd75d445b503d3a95e743b2cff8",
			"074bd51bbc30fa82ebe182fe9acaeedb8c7ef438",
			"110b33a9b62d44d9792e0b5489e7595414e32464",
			"83fa7c43089640b59f9ebd14ab76eed341284b26",
			"a9de15a3d57fb813133aee02a6ae0d356e269c08",
			"e35b6405fcf935e87fcfa50def7fa0f80efeb726",
			"0261c38912717678437bfccaf9dc82bc70261e02",
			"c9800a30504106c706326feea7567160ba67dad6",
			"797d205f3ba57f5b7a95d9c94c0ade68012a16f6",
			"6dac6a3ddb3ceec1f6c495d27143a77f6c5c838a",
			"1af6993dbcb5b1dfa7719273104789f392473e0f",
			"18e8111348312a2e2767dc7efb60f1f3df510ba5",
			"1b0610afe3d5bcc4a1974d0ab5e8771ec2e1136c",
			"1a5406ccf15a24d00a98b9a8032b935f107db3c7",
			"d82fbd903ee1e18c6a472e18d6216b0f3ae062d1",
			"3f5db998c2229ebb746b6bea276b30cf35e67209",
			"fc642d958803578c20d4c23dc4c22a81c3fed837",
			"5187b5640d7ca637dcc81752afa8c7186ba5b63a",
			"9ca79b85d01b26e17e01e9d2afa72f902e3cff1c",
			"6c8eac6e855e2ea8aeab605c070227fee4886f52",
			"fbd5bb18023140aa47441db95c5c6e425eb36755",
			"9037b528e4c59fb11f127e91e9dfce6981be93f9",
			"f824c4a8333300fb48b2a6f3180fdb7079e5df3f",
			"5ddd3993d2511402aad650bf8151f103d051e8fb",
			"f6a7743e006826f1bc0e67689a42ce59273903d0",
			"41510d24645438f3f7e26841985b57395ba4d63b",
			"ee7620a802a13bbdc0aab6ee9ed5be64af55deb7",
			"27dab68221b340a8e32117c2614206156641efb9",
			"915d5cda9e21ae6d6dd50475bbd5beaed9088c8e",
			"5f07b4e354fd330e2af82442d6e4feb9aa537dd9",
			"3a3e57b1de5abf4249926cc8f71be71b8008fe2e",
			"a7f5d9980188a6f146193447655d2b9a9c9a9b0b",
			"1bf603dc03acca6369e66c91477c6d5493720595",
			"7f1a82b40bae1b97c97505c2e038607e68d916ee",
			"97956b06fab7cea820753c1cb538071f99173a02",
			"b774f50e8fe309ffa9518296e0dca96e2b6aa329",
			"f148efed4c6dd03e6568167db4b94b5b0b91ff68",
			"d0275578f535d5644ada372923d749d86e2c91d1",
			"6004ca07f5dcd4b3539237fe48e11c3f07bc9c83",
			"d91b28a8d208c21fec5012f60d7052c0504043a4",
			"10e6520b81372c1f9215b41fd8de26dfc26265c9",
			"644d0643cac05a8c35a9ae75096684cb810453a1",
			"24d417effd3daabaf210d1c198c3cdb242eda0a1",
			"2f1d1a4ba1132a51624070e96699c9113e74e02e",
			"1b88e59648977946136b592352c92bbbf399acb6",
			"8a6b62892cfea4101ad0c7eefc465e14d7d46e09",
			"1eb88833f3619c907715160ba3db08a35f535a70",
			"4308833a3e042140f6f575f05e76e30e47a16e72",
			"05d449abf2a7c10c21d25db1fdce1f37547d41e2",
			"b1b4d7a79c8a616ce2929b073b389f9359bba734",
			"942bbf29e46a42c8d513504a5fcd3fb311da7557",
			"75b4172c7cf619d2862f85b5b94b0ebb50d70273",
			"0280d845615cd24cf32f766e251508f381c6978c",
			"f9e30a6b8ca6c0e401c88bda7700892ec068f3c4",
			"abb2b4d61bddcae851fc0b207ee2253d9640e1f2",
			"f547dc535fa50270b0dde4ae612a6eafa13d612d",
			"682c0454c7b3dea6dcee516c6262410e8938c849",
			"05f092dbcc41c1babe03956cd7da15ca6f997d12",
			"819272234eef7fd5a3c6513a88a4c03636095584",
			"1efed0d0ad95ff26142c576e63b8c602d39e0bfc",
			"d06a6fa2fc3ed12b2662a609a8fb6ce054c22353",
			"0669ea3d4a5faf5fafb5a70003ef2859c815bcb6",
			"773e810fd95414af969b79682bbd66f82a0f478c",
			"2480042e8eca6c91c5eda1f44b69134d09acfbaa",
			"e058be2882fc01a2185212edcee770bc59346f05",
			"0b7eee74be4866ebc23fc9355ce7d622435352a6",
			"95f0e6f558090371b657342e3fd9a3faedea4a7f",
			"dce6e24b4b72502995246ee0044953fcb8e7ea31",
			"daa8492c68c6a41bb8a44f184bff4166f5cd421d",
			"495865634d8c25f8e470cdf3864b62d175d3fc52",
			"73eedaacedcbe3d6fa6dbd61175e571c45dde5db",
			"65e718fbfa6dab8e8d5476cf134b607206e6d965",
			"f121729bc1bfc399056f2c75cb733686814720a0",
			"97459484cb0e0f41a1185c6e99fb994d00994aeb",
			"bb76acff886184885cd262993aa4881773345ccd",
			"961a83bbd5bd5f21490fe0c4415c5c43564981fb",
			"b0df9236b4470ccb92db426fa17f3355514499b0",
			"006950c9d7150c418c2a9affcb0fac1df9d5837e",
			"3d98209e094cb09f932183109c68aff8f6789120",
			"6539c449fb725fc647a01128392f71acd01c892e",
			"bb0f7986f49ba638c092ad7849964c43095571f0",
			"3b709254daa125c7f8440227c3fdcadf7583e616",
			"1bc75b9f978cfcb5f86be6b78de0670a228194ec",
			"3f9e7bf39c71bd1e781565e97311ec0bc9ca4dd8",
			"00e731f4917e805c8df7252228197bfd86dc3e85",
			"8e00ebfa454c91687b899f63cf224957966b32d4",
			"5a2ddf992d135a647e77ceefcdf8fd50b8f1b503",
			"7d4518eb1728f4d33a6d4a8b06ed666c11dfdfb7",
			"ee61b3f43ff8309923ee62386d8058578feb6992",
			"6f0079dc782cd267ee7f2bc1efac0b4e1b959ac7",
			"e24a499d0a46c2d5021260a0c858fcd62525f544",
			"3b82acd434b9bec22e76cd3ba276ce1b8e286318",
			"7c32caa24c73f52cc39f3af98d451f75bb2e8773",
			"e72249d9b6675f00c6411fa659d6b877cb94f32c",
			"29c57eeea632fcb862099db5e24cc45f13e6e0c3",
			"704301142885cbb14ea45de3b3cf758bfd97a3f4",
			"3451b5d2b387e7103b7fa855ca8899d4c0e04abc",
		];

		const toDelete = await db.scores.find({
			game: "iidx",
			chartID: { $in: beginners },
		});

		await DeleteMultipleScores(toDelete);
	},
	down: () => {
		throw new Error(`Reverting this change is not possible.`);
	},
};

export default migration;
