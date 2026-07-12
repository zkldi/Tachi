/* eslint no-labels: "off", "tachi/require-unicode-regexp": "off", no-irregular-whitespace: "off" */
import { Command } from "commander";
import { parse } from "csv-parse/sync";
import fs from "fs";

import { MutateCollection, ReadCollection } from "../../util.js";

// The tier lists are available at
// https://docs.google.com/spreadsheets/d/1cFltguBvPplBem-x1STHnG3k4TZzFfyNEZ-RwsQszoo/edit
// Download a given level's tierlist as CSV and use -f <CSV filename>.
// The level number will be picked up from the filename.
// For level 16 and 17, remove (更新停止) after the level from the filename

const SUPER_INDIV_DIFFERENCE = "超個人差";

const TIERS = {
	// 16 tiers are really weird for no good reason.
	16: {
		"16逆詐称(16F)": {
			text: "16F",
			value: 16.0,
		},
		...Object.fromEntries(
			[
				"16弱(16EとF) 地力　記号・A〜Z",
				"16弱(16EとF) 地力　あ〜わ",
				"16弱(16EとF)鍵盤・つまみ",
			].map((key) => [
				key,
				{
					text: "16E",
					value: 16.1,
				},
			]),
		),
		...Object.fromEntries(
			[
				"16中(16CとD)地力　記号・A〜Z",
				"16中(16CとD)地力　あ〜わ",
				"16中(16CとD)鍵盤・つまみ",
			].map((key) => [
				key,
				{
					text: "16C/D",
					value: 16.3,
				},
			]),
		),
		...Object.fromEntries(
			["16強(16AとB) 地力", "16強(16AとB) 鍵盤・つまみ"].map((key) => [
				key,
				{
					text: "16A/B",
					value: 16.5,
				},
			]),
		),
		"16強+(16A以上S未満)": {
			text: "16A+",
			value: 16.7,
		},
		"16詐称(16S)": {
			text: "16S",
			value: 16.9,
		},
	},
	17: {
		A: {
			text: "17A",
			value: 17.7,
		},
		"A+": {
			text: "17A+",
			value: 17.8,
		},
		B: {
			text: "17B",
			value: 17.5,
		},
		"B+": {
			text: "17B+",
			value: 17.6,
		},
		C: {
			text: "17C",
			value: 17.4,
		},
		D: {
			text: "17D",
			value: 17.3,
		},
		E: {
			text: "17E",
			value: 17.2,
		},
		F: {
			text: "17F",
			value: 17.1,
		},
		"F-": {
			text: "17F-",
			value: 17.0,
		},
		// There is no S, don't ask me why.
	},
	18: {
		A: {
			text: "18A",
			value: 18.7,
		},
		"A+": {
			text: "18A+",
			value: 18.8,
		},
		B: {
			text: "18B",
			value: 18.6,
		},
		C: {
			text: "18C",
			value: 18.5,
		},
		D: {
			text: "18D",
			value: 18.3,
		},
		E: {
			text: "18E",
			value: 18.1,
		},
		F: {
			text: "18F",
			value: 18.0,
		},
		S: {
			text: "18S",
			value: 18.9,
		},
		SS: {
			// Literally just Joyeuse lmao
			text: "18SS",
			value: 19.5, //if this were a score tier list this would be in the 20s
		},
	},
	19: {
		A: {
			text: "19A",
			value: 19.7,
		},
		"A+": {
			text: "19A+",
			value: 19.9,
		},
		B: {
			text: "19B",
			value: 19.5,
		},
		C: {
			text: "19C",
			value: 19.4,
		},
		D: {
			text: "19D",
			value: 19.3,
		},
		E: {
			text: "19E",
			value: 19.1,
		},
		F: {
			text: "19F",
			value: 19.0,
		},
		S: {
			text: "19S",
			value: 20.0,
		},
	},
	20: {
		A: {
			text: "20A",
			value: 20.3,
		},
		"A+": {
			text: "20A+",
			value: 20.5,
		},
		B: {
			text: "20B",
			value: 20.1,
		},
		S: {
			text: "20S",
			value: 20.5, // These are literally no harder than anything in A+ clear wise
		},
	},
};

const MANUAL_TITLE_MAP = {
	// 18s
	"*Erm,～ ShockWAVE Syndrome...?": "* Erm, could it be a Spatiotemporal ShockWAVE Syndrome...?",
	".59 -BOOTH REMIX-": ".59 -BOOTH BOOST REMIX-",
	// In their defence I make this typo all the time
	"50th Memorial Songs -Begining Story-": "50th Memorial Songs -Beginning Story-",
	"50th Memorial Songs-二人の時-": "50th Memorial Songs -二人の時 ～under the cherry blossoms～-",
	"ABSOLUTE(ismk passionate mix)": "ABSOLUTE(ismK passionate remix)",
	Applique: "Appliqué",
	AΩ: "ΑΩ", // they use latin A instead of alpha
	"Believe (y)our Wings{V:VID RAYS}": "Believe (y)our Wings {V:IVID RAYS}",
	// 19s
	// See Blue Forest
	"Breakneek Pursuit": "Breakneck Pursuit",
	"Bule Forest (Prog Key Remix)": "Blue Forest (Prog Keys Remix)",
	// I am not changing the parser to account for missing brackets, and this would
	// need an override anyways. Included the second one in case they fix it later.
	"Bule Forest (Prog Key Remix)[MXM": "Blue Forest (Prog Keys Remix)",
	"cloche(といぼっくすうぃんぐ　りみっくす)": "cloche(といぼっくすうぃんぐ　みっくす)",
	"Cross Fire[MXM": "Cross Fire",
	"Daydream Cafê(Euro Hopping Mix)": "Daydream café (Euro Hopping Mix)",
	"Electric Injuly": "Electric Injury", // holy shit dude
	"Elemental Creation(Kamome mix)": "Elemental Creation (kamome sano Remix)",
	// 17s
	"Emperors divide": "Emperor's Divide",
	"Engraved Mark -Gow's ill!-": "Engraved Mark-Gow's ill! RMX-",
	"EOS INFINITE EDIT": "EOS -INFINITE EDIT-",
	"FIRST:DREAM": "FIRST：DREAMS",
	"Flaa Behaivor": "Flaa Behavior",
	FlwoerNation: "FlowerNation",
	"G4ME OVEЯ": "G4ME ØVEЯ", // This is also in 16s spelled differently :////
	// This is NOT "Game Over". This is an EG chart and isn't in this
	// repo yet but better to avoid confusion down the line.
	"GAME ØVER": "G4ME ØVEЯ",
	"Genesis At Oasis(Matsudo)": "Genesis At Oasis (Hirayasu Matsudo Remix)",
	graduaition: "graduation",
	"Hello､Hologram": "Hello, Hologram",
	// "Help me, CODYYYYYY!!" is a special title that only applies to the GRV... why, sdvx, why
	"Help me,CODYYYYYY!!": "Help me, ERINNNNNN!! - SH Style -",
	"Help me ERINNNNNN!! -Cranky remix-": "Help me, ERINNNNNN!! -Cranky remix-",
	Idora: "Idola", // I should just normalize out R/L...
	"Iridescent Crouds": "Iridescent Clouds", // there's so many people I can't see!
	// 16s
	"jack-the-Ripper♦": "Jack-the-Ripper◆",
	"KAC 2013 MEDLEY Emperor Side": "KAC 2013 ULTIMATE MEDLEY -HISTORIA SOUND VOLTEX- Emperor Side",
	"KAC 2013 MEDLEY Empress Side": "KAC 2013 ULTIMATE MEDLEY -HISTORIA SOUND VOLTEX- Empress Side",
	"Make Majic": "Make Magic", // asdf
	"Narcissus At Oasis (Freezer)": "Narcissus At Oasis (Freezer Remix)",
	"Narcissus At Oasis 影虎。style": "Narcissus At Oasis -影虎。 style-",
	"Now Loading...": "Now loading…",
	"One In A Billion(Hedonist Rimix)": "One In A Billion（Hedonist Remix）",
	"PHYCHO+HEROES": "PSYCHO+HEROES",
	"Pixelated Platform（Superhoney）": "Pixelated Platform (Super Honey!)",
	"POSSESSION (Aoi Q.E.DRMX)": "POSSESSION (Aoi Q.E.D. RMX)",
	Redo: "Redo／アニメ「Re:ゼロから始める異世界生活」より",
	"Rhapsody ⚙︎f Triumph": "Rhapsody ⚙f Triumph", // There is some weird non-printing character here fml

	// There are two prefix-matches for this, so we need to be explicit.
	RPG: "RPG／アニメ「映画クレヨンしんちゃん バカうまっ！B級グルメサバイバル！！」より",
	"Sacrifce Escape: 不条理の模倣による感情と代償":
		"Sacrifice Escape: 不条理の模倣による感情と代償",
	"Sakura Reflection(P*Light Remix)": "Sakura Reflection (P*Light Slayer Remix)",
	"Sayonara Planet Wars(Sot-c)": "Sayonara Planet Wars (Sot-C Remix)",
	"She is my wife ミツル子Remixちゃん": "She is my wife すーぱーアイドル☆ミツル子Remixちゃん",
	'Spectacular"V"Adventure!': "Spectacular“V”Adventure!",
	"stella rain": "stellar rain",
	SuperMiracleEmsemble: "SuperMiracleEnsemble",
	"TENKAICHI ULTIMATE MEDLEY": "TENKAICHI ULTIMATE BOSSRUSH MEDLEY",
	"Thank you for playing music": "Thank you for your playing music", // LMFAOOO
	"The Sampling Paradise(P*Light)": "The Sampling Paradise (P*Light Remix)",
	"Togather Going My Way": "Together Going My Way", // lol
	"U.N.オーエンは彼女なのか(TO-HOlic)": "U.N.オーエンは彼女なのか？(TO-HOlic mix)",
	"Unicorn tail Dustnoxxxx RMX": "Unicorn tail Dustboxxxx RMX",
	"VALKYRIE ASAULT": "VALKYRIE ASSAULT",
	"Venomous Firefry": "Venomous Firefly", // you fry them up real good
	あいあむなんばーわんぱとらちゃん様: "あいあむなんばーわんパトラちゃん様", // hirigana/katakana
	"おーまい！らぶりー！すうぃーてぃー！だーりん！":
		"おーまい！らぶりー！すうぃーてぃ！だーりん！",
	"けもののおうじゃ めうめう": "けもののおうじゃ★めうめう",
	"しゅわスパ大作戦☆(カシオれ！くーにゃん)": "しゅわスパ大作戦☆ (カシオれ！くーにゃんリミックス)",
	すきなことでいいです: "すきなことだけでいいです",
	"ちくわパフェだよ☆ＣＫＰ(Yvya)": "ちくわパフェだよ☆ＣＫＰ (Yvya Remix)",
	"ませまてぃっく♡ま＋ま＝まじっく！(リミ)":
		"ませまてぃっく♡ま＋ま＝まじっく！　～徹夜の追込みエナジーまっくす！～",
	"めうめうぺったんたん!!(ZAQUVA)": "めうめうぺったんたん！！ (ZAQUVA Remix)",
	"ゆりゆらららゆるゆり大事件 (yuzenリミ)": "ゆりゆららららゆるゆり大事件（yuzen remix）",
	"アルティメットトゥルース_-Phantasm-": "アルティメットトゥルース -Phantasm-",
	"イゴモヨスのブヨブヨ・スケッチ": "イゴモヨス＝オムルのテーマによるブヨブヨ・スケッチの試み",

	"コンベア速度Maxしゃいにん☆廻転ズシ": 'コンベア速度Max!? しゃいにん☆廻転ズシ"Sushi&Peace"',
	"サヨナラ・ヘヴン(かめりあ`sRMX)": "サヨナラ・ヘヴン （かめりあ's NEKOMATAelectroRMX）",
	チルノとまりおのパーフェクト算数教室: "チルノとまりおのパーフェクトさんすう教室", // I guess???
	"トウキョーサマーナイト（華金Remix）": "トーキョーサマーナイト（華金Remix）",
	"ドリームエンド・サバイバー(Hidra-Xjeil)": "ドリームエンド・サバイバー(Hidra-Xjeil Remix)",
	マーメイドペレパシィ: "マーメイドペレパスィ",
	"ユニバーページ(i-word Mix)": "ユニバーページ（i-world Mix）",
	"仔羊のナヴァラン・クリシェを添えて": "～仔羊のナヴァラン・クリシェを添えて～",
	"動く、動く(Electro Remix)": '動く、動く（"A&M Chillin\' " Electro Remix）',
	"双翼 Black Wings - SDVX Edit. -": "双翼 - Black Wings - SDVX Edit. -",
	"夏色DIARY -SD'VmiX-": "夏色DIARY -Summer Dazzlin' Vacation miX-",
	"少年は空を辿る Prog Piano Rmx": "少年は空を辿る Prog Piano Remix",
	幻想郷DENPASTICグリーティング: "幻想郷DEMPASTICグリーティング",
	"怪盗Fの台本 ～消えたダイヤの謎～": "怪盗Ｆの台本～消えたダイヤの謎～", // F
	"感情の摩天楼～Arr.Demetori": "感情の魔天楼 ～ Arr.Demetori",
	泥の分際で私だけの大切を奪おうなんて: "泥の分際で私だけの大切を奪おうだなんて",
	"消失(Hommarju Rremix)": "消失(Hommarju Remix)", // ur supposed to roll the Rr
	"混乱少女そふらんちゃん!!": "混乱少女♥そふらんちゃん!!",
	"無意識レクイエム(cosmobsp mix)": "無意識レクイエム (cosmobsp rmx)",
	熱情のザパデアート: "熱情のサパデアード",
	物凄いｽﾍﾟｰｽｼｬﾄﾙでこいしが物凄いうた: "物凄いスペースシャトルでこいしが物凄いうた", // also not 100% sure
	色は匂えど散りぬるを: "色は匂へど散りぬるを",
	"赤より紅い夢-Aya2g Tech Dance Rmx-": "赤より紅い夢-Aya2g Tech Dance Remix-",
	超超光速スピードスターかなで: "超☆超☆光☆速☆出☆前☆最☆速!!! スピード★スター★かなで", // understandable
	"闇夜舞踏会 -緋碧と蝶のための-masquerade-": "闇夜舞踏会 -緋碧と蝶のためのmasquerade-",

	"雪月花 (Shiron)": "雪月花 (Shiron & Sound Artz Remix)",
	"＝∴NOMADE∵OTION＝": "=∴NOMADE∵OTION=",
	"［E］": "[E]",
};

function validTiers(levelNum) {
	return Object.keys(TIERS[levelNum]).concat([SUPER_INDIV_DIFFERENCE]);
}

function normalizeTitle(title) {
	return title
		.toLowerCase()
		.replace(/ /g, "")
		.replace(/　/g, "")
		.replace(/ /g, "")
		.replace(/：/g, ":")
		.replace(/（/g, "(")
		.replace(/）/g, ")")
		.replace(/！/g, "!")
		.replace(/？/g, "?")
		.replace(/`/g, "'")
		.replace(/’/g, "'")
		.replace(/”/g, '"')
		.replace(/～/g, "~");
}

function findSong(songs, title) {
	// There are two songs called "Life is [Bb]eautiful". Yes, really.
	// I CANNOT be assed to search both songs by level or case-sensitive.
	// There are also two level 18's called "Prayer"
	if (title === "Life is beautiful") {
		return songs.find((song) => song.id === 1264);
	} else if (title === "Prayer(溝口ゆうま)") {
		return songs.find((song) => song.id === 2129);
	} else if (title === "Prayer(ぺのれり)") {
		return songs.find((song) => song.id === 803);
	}

	const song = songs.find(
		(song) =>
			normalizeTitle(song.title) === normalizeTitle(title) ||
			song.title === MANUAL_TITLE_MAP[title],
	);
	if (song) {
		return song;
	}

	// Only do prefix match _after_ trying normal match, since there are some
	// correct song titles that are also prefixes of other song titles
	// (e.g. チルノのパーフェクトさんすう教室 and チルノのパーフェクトさんすう教室　⑨周年バージョン
	// or Elemental Creation and Elemental Creation (kamome sano Remix)).
	const prefixSong = songs.find((song) =>
		normalizeTitle(song.title).startsWith(normalizeTitle(title)),
	);
	if (prefixSong) {
		console.log(`Prefix-matched ${title} to ${prefixSong.title}.`);
	}
	return prefixSong;
}

// levelNum: a number 16-20
// csvData: raw CSV data from the sheet, in a nested list
// headerRow: the index (0-indexed) of the row with the tier names
// leftOffset: the index of the first column with tierlist info
// simple: do not check for double columns or other weird things (19-20)
function addTiers(levelNum, csvData, headerRow, leftOffset, simple) {
	const songs = ReadCollection("songs-sdvx.json");

	MutateCollection("charts-sdvx.json", (charts) => {
		let col = leftOffset;
		let row = headerRow;

		tierLoop: while (col < csvData[headerRow].length) {
			let tierName = csvData[row][col];

			// Try to remove the total number of songs in each tier.
			// e.g. "      A          曲数:54"
			//                        ^^^^^^
			// They use irregular spaces for these cases
			// Level 16 shouldn't have these replaced though
			if (levelNum !== 16) {
				tierName = tierName.replace(/\u3000/g, " ");
			}

			const totalCount = tierName.match(/曲数:[0-9]+/);

			if (totalCount) {
				tierName = tierName.slice(0, totalCount.index).trim();
			}

			if (tierName === "" && col > leftOffset) {
				// This might be a double column (two columns for the same tier),
				// so check the cell to the left.
				tierName = csvData[row][col - 1];
			}
			if (!validTiers(levelNum).includes(tierName)) {
				// We're probably just done.
				console.log(`"${tierName}" does not match a known tier, so we should be finished.`);
				break;
			}
			console.log(`\nProcessing tier ${tierName} at [${row}, ${col}]`);
			row++;

			const superDiff = tierName === SUPER_INDIV_DIFFERENCE;

			const baseTier = !superDiff
				? TIERS[levelNum][tierName]
				: {
						text: SUPER_INDIV_DIFFERENCE,
						value: levelNum,
					};

			while (row < csvData.length) {
				let chartString = csvData[row++][col].trim();
				if (chartString === "") {
					break;
				}

				const tier = {
					...baseTier,
					individualDifference: superDiff,
				};

				// A few overrides.
				// 【Believe (y)our Wings{V:VID RAYS}】[MXM]
				chartString = chartString.replace(/^【(.+)】(\[[A-Z]{3}\])$/, "【$1$2】");
				// Star is outside brackets bc fuck you
				if (chartString === "※【Opium and Purple haze[GRV]】") {
					tier.individualDifference = true;
					chartString = "Opium and Purple haze[GRV]";
				}

				if (superDiff) {
					// Extract a range to display (e.g. "18A+ - 18D").
					// The two ～ characters are different and both are in use.
					let rangeMatch = chartString.match(/^(.+)\((\d{2}.+)[~〜～](\d{2}.+)\)$/);
					if (!rangeMatch) {
						// 19s
						// Yes, there really is no closing paren.
						rangeMatch = chartString.match(/^【(.+)\((19.+)[〜～](19.+)】$/);
					}

					// 16s don't have ranges, so if we can't find it, no sweat.
					if (rangeMatch) {
						chartString = rangeMatch[1];
						tier.text = `${rangeMatch[2]} - ${rangeMatch[3]}`;
					} else {
						console.log(
							`No range found for individual difference chart ${chartString}.`,
						);
					}
				}

				// We don't actually store this but need to get rid of the brackets.
				const sightreadKillerMatch = chartString.match(/^【(.*?) ?】$/);
				if (sightreadKillerMatch) {
					chartString = sightreadKillerMatch[1];
				}

				const individualDifferenceMatch = chartString.match(/^※(.*)$/);
				if (individualDifferenceMatch) {
					tier.individualDifference = true;
					chartString = individualDifferenceMatch[1];
				}

				// Not every entry has the diff, but we need it to distinguish between a few charts
				// (e.g. KHAMEN BREAK) that have two diffs at the same level.
				const [_, title, difficulty] = chartString.match(/^(.*?)(?:\[([A-Z]{3})\])?$/);
				if (
					difficulty &&
					!["ADV", "EXH", "GRV", "HVN", "INF", "MXM", "NOV", "VVD", "XCD"].includes(
						difficulty,
					)
				) {
					console.log(`Unknown difficulty ${difficulty} for ${title}.`);
				}

				const song = findSong(songs, title);
				if (!song) {
					console.log(`Unable to find song matching ${title}`);
					continue;
				}

				let chart = charts.find(
					(chart) =>
						chart.song.id === song.id &&
						chart.levelNum === levelNum &&
						chart.difficulty === difficulty,
				);
				if (!chart) {
					// Sometimes the difficulty is missing, or straight up wrong (e.g. MXM instead of VVD) so just try without.
					chart = charts.find(
						(chart) => chart.song.id === song.id && chart.levelNum === levelNum,
					);
				}

				if (!chart) {
					console.log("Can't find chart:");
					console.log(`tierlist title ${title} matches song ${song.title} (${song.id})`);
					console.log(`at [${difficulty}] ${levelNum}`);
					continue;
				}
				if ("clearTier" in chart.data && chart.data.clearTier.value !== tier.value) {
					console.log(`\nOverwriting tier for ${song.title} [${chart.difficulty}]`);
					console.log(
						`${chart.data.clearTier.text} (${chart.data.clearTier.value}) -> ${tier.text} (${tier.value})`,
					);
				}
				chart.data.clearTier = tier;
			}

			if (simple || row >= csvData.length) {
				row = headerRow;
				col++;
				continue tierLoop;
			}

			while (csvData[row][col] === "") {
				row++;
				if (row >= csvData.length) {
					// Next column.
					row = headerRow;
					col++;
					continue tierLoop;
				}
			}

			// If we get here, we have found something at the bottom of the column.
			const cell = csvData[row][col];
			if (cell === tierName) {
				// This signifies the end of the column.
				row = headerRow;
				col++;
				continue tierLoop;
			}
			if (validTiers(levelNum).includes(cell)) {
				console.log(`Found a second tier in column ${col} at row ${row}.`);
				// There is another tier, here, continue without resetting col.
				continue tierLoop;
			}

			// Otherwise, not sure what we found, but just move on to the next column.
			row = headerRow;
			col++;
		}

		const missingTiers = charts.filter(
			(chart) => chart.levelNum === levelNum && !("clearTier" in chart.data),
		);
		if (missingTiers.length > 0) {
			console.log(`\nThe following lv${levelNum} charts are still missing a tier:`);
			for (const chart of missingTiers) {
				const song = songs.find((song) => song.id === chart.song.id);
				console.log(
					`${song.id}: ${song.title} [${chart.difficulty}] (displayVersion: ${song.data.displayVersion})`,
				);
			}
		}

		return charts;
	});
}

const program = new Command();
program.option("-f, --file <CSV File>");
program.parse(process.argv);
const options = program.opts();

const csvData = parse(fs.readFileSync(options.file), {});

const levelIndicator = options.file.match(/ - (Lv.*).csv$/);
if (!levelIndicator) {
	console.log("Unrecognized filename.");
}
switch (levelIndicator[1]) {
	case "Lv16":
		addTiers(16, csvData, 2, 1, false);
		break;
	case "Lv17":
		addTiers(17, csvData, 2, 0, false);
		break;
	case "Lv18":
		addTiers(18, csvData, 1, 0, false);
		break;
	case "Lv19,20":
		addTiers(20, csvData, 1, 1, true);

		// Locate start of 19s
		// eslint-disable-next-line
		let header19 = -1;
		for (const rowIdx in csvData) {
			if (csvData[rowIdx][0] === "Lv19") {
				header19 = rowIdx;
				break;
			}
		}

		addTiers(19, csvData, header19, 1, true);
		break;
	default:
		console.log("Unrecognized level");
		break;
}
