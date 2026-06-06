import type { BMSGames } from "../types";

import { COLOUR_SET } from "./colour-set";

export interface BMSTableInfo {
	prefix: string;

	/**
	 * Used to generate tableIDs and folder slugs. This stops us from having characters like "◎" in tableIDs
	 * which would undoubtedly break some URLs. (Also referred to as an ASCII-friendly identifier for the
	 * `prefix`.)
	 */
	asciiPrefix: string;
	name: string;
	description: string;
	game: BMSGames;
	url: string;

	// Should this table be hidden in the UI by default?
	notDefault?: boolean;

	// What colour should this table be in the UI?
	// If no colour is provided, it defaults to gray.
	colour?: string;
}

// I have no confidence in half of these links surviving.
// Eventually, some of these are going to disappear, and we'll have to find
// something else. probably.
export const BMS_TABLES: Array<BMSTableInfo> = [
	{
		name: "Insane",
		game: "bms-7k",
		description: "The 7K GENOSIDE insane table.",
		url: "https://darksabun.club/table/archive/insane1",
		prefix: "★",
		asciiPrefix: "insane",
		colour: COLOUR_SET.red,
	},
	{
		name: "Normal",
		game: "bms-7k",
		description: "The 7K GENOSIDE normal table.",
		url: "https://darksabun.club/table/archive/normal1",
		prefix: "☆",
		asciiPrefix: "normal",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "Stella",
		game: "bms-7k",
		description: "The stella table, from Stellaverse.",
		url: "https://stellabms.xyz/st/table.html",
		prefix: "st",
		asciiPrefix: "stella",
		colour: COLOUR_SET.teal,
	},
	{
		name: "Satellite",
		game: "bms-7k",
		description: "The satellite table, from Stellaverse.",
		url: "https://stellabms.xyz/sl/table.html",
		prefix: "sl",
		asciiPrefix: "satellite",
		colour: COLOUR_SET.vibrantBlue,
	},
	{
		name: "Insane2",
		game: "bms-7k",
		description: "A successor to the original insane table, but is generally less consistent.",
		url: "https://rattoto10.github.io/second_table/insane_header.json",
		prefix: "▼",
		asciiPrefix: "insane2",
		colour: COLOUR_SET.maroon,
	},
	{
		name: "Normal2",
		game: "bms-7k",
		description: "A successor to the original normal table.",
		url: "https://rattoto10.github.io/second_table/header.json",
		prefix: "▽",
		asciiPrefix: "normal2",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "Overjoy",
		description: "The overjoy table. Level 1 is roughly equivalent to Insane 20.",
		game: "bms-7k",
		url: "http://rattoto10.jounin.jp/table_overjoy.html",
		prefix: "★★",
		asciiPrefix: "overjoy",
		colour: COLOUR_SET.paleOrange,
	},
	{
		name: "DP Insane",
		description: "The 14K Insane table.",
		game: "bms-14k",
		prefix: "★",
		asciiPrefix: "dpInsane",
		url: "http://dpbmsdelta.web.fc2.com/table/insane.html",
		colour: COLOUR_SET.red,
	},
	{
		name: "DP Normal",
		description: "The 14K Normal table, Sometimes called the delta table.",
		game: "bms-14k",
		prefix: "δ",
		asciiPrefix: "dpNormal",
		url: "http://dpbmsdelta.web.fc2.com/table/dpdelta.html",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "DP Satellite",
		description: "The 14K Satellite table.",
		game: "bms-14k",
		prefix: "DPsl",
		asciiPrefix: "dpSatellite",
		url: "https://stellabms.xyz/dp/table.html",
		colour: COLOUR_SET.vibrantBlue,
	},
	{
		name: "Scratch 3rd",
		description: "The 7K Sara 3 table.",
		prefix: "h◎",
		asciiPrefix: "scratch",
		game: "bms-7k",
		url: "http://minddnim.web.fc2.com/sara/3rd_hard/bms_sara_3rd_hard.html",
		colour: COLOUR_SET.vibrantRed,
	},
	{
		name: "LN",
		description: "The 7K LN table.",
		prefix: "◆",
		asciiPrefix: "ln",
		game: "bms-7k",
		url: "http://flowermaster.web.fc2.com/lrnanido/gla/LN.html",
		colour: COLOUR_SET.pink,
	},
	{
		name: "Stardust",
		prefix: "ξ",
		asciiPrefix: "stardust",
		game: "bms-7k",
		url: "https://mqppppp.neocities.org/StardustTable.html",
		description: "The 7K Stardust table. This table covers ☆1 to ☆7.",
		colour: COLOUR_SET.paleBlue,
	},
	{
		name: "Starlight",
		prefix: "sr",
		asciiPrefix: "starlight",
		game: "bms-7k",
		url: "https://djkuroakari.github.io/starlighttable.html",
		description: "The 7K Starlight table. This table covers ☆7 to ☆12.",
		colour: COLOUR_SET.blue,
	},
	{
		name: "LN Overjoy",
		prefix: "◆◆",
		asciiPrefix: "lnOverjoy",
		game: "bms-7k",
		url: "https://notepara.com/glassist/lnoj",
		description: "The 7K LN Overjoy table.",
		notDefault: true,
		colour: COLOUR_SET.vibrantPink,
	},
	{
		name: "Luminous",
		prefix: "ln",
		asciiPrefix: "luminous",
		game: "bms-7k",
		url: "https://ladymade-star.github.io/luminous/",
		description: "The 7K Luminous Table. This is an alternative to the mainline LN tables.",
		notDefault: true,
		colour: COLOUR_SET.purple,
	},
	{
		name: "Gachimijoy",
		prefix: "双",
		asciiPrefix: "gachimijoy",
		game: "bms-7k",
		url: "https://yeslyko.github.io/gachimijoy-mirror/",
		notDefault: true,
		description:
			"Gachimijoy is a gachi practice table. 双1 is approximately equivalent to an ★★1",
	},
	{
		name: "delayjoy",
		asciiPrefix: "delayjoy",

		// The upstream table ships with a bare-space symbol rather than "dl".
		// We proxy it through our own custom-tables endpoint which normalises the
		// symbol and level names, so point the sync job at our proxy instead.
		url: "https://boku.tachi.ac/api/v1/games/bms-7k/custom-tables/delayjoy-fixed",
		game: "bms-7k",
		prefix: "dl",
		notDefault: true,
		description:
			"Delayjoy is a delay practice table. dl0 is approximately equivalent to an st0",
	},
	{
		name: "Arm Shougakkou",
		asciiPrefix: "armShougakkou",

		// The upstream table ships with a bare-space symbol rather than "Ude".
		// We proxy it through our own custom-tables endpoint which normalises the
		// symbol and level names, so point the sync job at our proxy instead.
		url: "https://boku.tachi.ac/api/v1/games/bms-7k/custom-tables/arm-shougakkou-fixed",
		game: "bms-7k",
		prefix: "Ude",
		notDefault: true,
		description:
			"The Arm-Shougakkou table is a gachi and gachi-ish practice table. Ude0 is approximately equivalent to an sl0",
	},
	{
		name: "Exoplanet",
		asciiPrefix: "exoplanet",
		url: "https://stellabms.xyz/fr/table.html",
		game: "bms-7k",
		prefix: "fr",
		notDefault: true,
		description:
			"Exoplanet is a table by the stella/satellite maintainers with less rules on what can be submitted. Includes gimmick charts.",
	},
	{
		name: "DP Library",
		asciiPrefix: "dpLibrary",
		url: "https://yaruki0.net/DPlibrary/",
		game: "bms-14k",
		prefix: "☆",
		notDefault: true,
		description: "A huge collection of Normal-Scale 14K charts.",
	},
	{
		name: "Dystopia",
		game: "bms-7k",
		description: "The dystopia table, dy0-dy7 == st5-st12.",
		url: "https://monibms.github.io/Dystopia/dystopia.html",
		prefix: "dy",
		asciiPrefix: "dystopia",
		colour: COLOUR_SET.purple,
	},
	{
		name: "Scramble",
		prefix: "SB",
		asciiPrefix: "Scramble",
		game: "bms-7k",
		description: "The Scramble table, a 7k scratch table",
		url: "https://egret9.github.io/Scramble/",
		colour: COLOUR_SET.vibrantOrange,
	},
	{
		name: "Supernova",
		asciiPrefix: "supernova",
		url: "https://stellabms.xyz/sn/table.html",
		game: "bms-7k",
		prefix: "sn",
		description:
			"Supernova, Stellaverse's alternative table for Insane1-esque charts. Follows the Stella table in difficulty.",
	},
	{
		name: "Solar",
		asciiPrefix: "solar",
		url: "https://stellabms.xyz/so/table.html",
		game: "bms-7k",
		prefix: "so",
		description:
			"Solar, Stellaverse's alternative table for Insane1-esque charts. Follows the Satellite table in difficulty.",
	},
	{
		name: "Code Stream (st)",
		asciiPrefix: "csst",
		url: "https://air-afother.github.io/chordstream-table-split/chordstreamST.html",
		game: "bms-7k",
		prefix: "重発狂",
		description: "16th Chordstream table, st0+ difficulty",
	},
	{
		name: "Code Stream (sl)",
		asciiPrefix: "cssl",
		url: "https://air-afother.github.io/chordstream-table-split/chordstream.html",
		game: "bms-7k",
		prefix: "乱打",
		description: "16th Chordstream table, sl0-sl12 difficulty",
	},
	{
		name: "PMS ● (controller)",
		game: "pms-controller",
		prefix: "●",
		asciiPrefix: "pmsCircle",
		description: "The Insane PMS table (PASTORAL). This table starts around pop'n level 46.",
		url: "https://pmsdifficulty.xxxxxxxx.jp/_pastoral_insane_table.html",
		colour: COLOUR_SET.red,
	},
	{
		name: "PMS P● (controller)",
		game: "pms-controller",
		prefix: "P●",
		asciiPrefix: "pmsPStar",
		description: "The PMS Database insane table. Contains almost every PMS file at Lv46+.",
		url: "https://pmsdifficulty.xxxxxxxx.jp/insane_PMSdifficulty.html",
		colour: COLOUR_SET.maroon,
	},
	{
		name: "PMS ● (keyboard)",
		game: "pms-keyboard",
		prefix: "●",
		asciiPrefix: "pmsCircle",
		description: "The Insane PMS table (PASTORAL). This table starts around pop'n level 46.",
		url: "https://pmsdifficulty.xxxxxxxx.jp/_pastoral_insane_table.html",
		colour: COLOUR_SET.red,
	},
	{
		name: "PMS P● (keyboard)",
		game: "pms-keyboard",
		prefix: "P●",
		asciiPrefix: "pmsPStar",
		description: "The PMS Database insane table. Contains almost every PMS file at Lv46+.",
		url: "https://pmsdifficulty.xxxxxxxx.jp/insane_PMSdifficulty.html",
		colour: COLOUR_SET.maroon,
	},
];
