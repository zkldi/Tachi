import { COLOUR_SET } from "./colour-set";
import type { Playtypes } from "../types";

export interface BMSTableInfo {
	prefix: string;

	/**
	 * Used to generate tableIDs. This stops us from having characters like "◎" in tableIDs
	 * which would undoubtedly break some URLs.
	 */
	asciiPrefix: string;
	name: string;
	description: string;
	playtype: Playtypes["bms"];
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
		playtype: "7K",
		description: "The 7K GENOSIDE insane table.",
		url: "https://darksabun.github.io/table/archive/insane1/",
		prefix: "★",
		asciiPrefix: "insane",
		colour: COLOUR_SET.red,
	},
	{
		name: "Normal",
		playtype: "7K",
		description: "The 7K GENOSIDE normal table.",
		url: "https://darksabun.github.io/table/archive/normal1/",
		prefix: "☆",
		asciiPrefix: "normal",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "Stella",
		playtype: "7K",
		description: "The stella table, from Stellaverse.",
		url: "https://stellabms.xyz/st/table.html",
		prefix: "st",
		asciiPrefix: "stella",
		colour: COLOUR_SET.teal,
	},
	{
		name: "Satellite",
		playtype: "7K",
		description: "The satellite table, from Stellaverse.",
		url: "https://stellabms.xyz/sl/table.html",
		prefix: "sl",
		asciiPrefix: "satellite",
		colour: COLOUR_SET.vibrantBlue,
	},
	{
		name: "Insane2",
		playtype: "7K",
		description: "A successor to the original insane table, but is generally less consistent.",
		url: "https://rattoto10.github.io/second_table/insane_header.json",
		prefix: "▼",
		asciiPrefix: "insane2",
		colour: COLOUR_SET.maroon,
	},
	{
		name: "Normal2",
		playtype: "7K",
		description: "A successor to the original normal table.",
		url: "https://rattoto10.github.io/second_table/header.json",
		prefix: "▽",
		asciiPrefix: "normal2",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "Overjoy",
		description: "The overjoy table. Level 1 is roughly equivalent to Insane 20.",
		playtype: "7K",
		url: "http://rattoto10.jounin.jp/table_overjoy.html",
		prefix: "★★",
		asciiPrefix: "overjoy",
		colour: COLOUR_SET.paleOrange,
	},
	{
		name: "DP Insane",
		description: "The 14K Insane table.",
		playtype: "14K",
		prefix: "★",
		asciiPrefix: "dpInsane",
		url: "http://dpbmsdelta.web.fc2.com/table/insane.html",
		colour: COLOUR_SET.red,
	},
	{
		name: "DP Normal",
		description: "The 14K Normal table, Sometimes called the delta table.",
		playtype: "14K",
		prefix: "δ",
		asciiPrefix: "dpNormal",
		url: "http://dpbmsdelta.web.fc2.com/table/dpdelta.html",
		colour: COLOUR_SET.paleGreen,
	},
	{
		name: "DP Satellite",
		description: "The 14K Satellite table.",
		playtype: "14K",
		prefix: "sl",
		asciiPrefix: "dpSatellite",
		url: "https://stellabms.xyz/dp/table.html",
		colour: COLOUR_SET.vibrantBlue,
	},
	{
		name: "Scratch 3rd",
		description: "The 7K Sara 3 table.",
		prefix: "h◎",
		asciiPrefix: "scratch",
		playtype: "7K",
		url: "http://minddnim.web.fc2.com/sara/3rd_hard/bms_sara_3rd_hard.html",
		colour: COLOUR_SET.vibrantRed,
	},
	{
		name: "LN",
		description: "The 7K LN table.",
		prefix: "◆",
		asciiPrefix: "ln",
		playtype: "7K",
		url: "http://flowermaster.web.fc2.com/lrnanido/gla/LN.html",
		colour: COLOUR_SET.pink,
	},
	{
		name: "Stardust",
		prefix: "ξ",
		asciiPrefix: "stardust",
		playtype: "7K",
		url: "https://mqppppp.neocities.org/StardustTable.html",
		description: "The 7K Stardust table. This table covers ☆1 to ☆7.",
		colour: COLOUR_SET.paleBlue,
	},
	{
		name: "Starlight",
		prefix: "sr",
		asciiPrefix: "starlight",
		playtype: "7K",
		url: "https://djkuroakari.github.io/starlighttable.html",
		description: "The 7K Starlight table. This table covers ☆7 to ☆12.",
		colour: COLOUR_SET.blue,
	},
	{
		name: "LN Overjoy",
		prefix: "◆◆",
		asciiPrefix: "lnOverjoy",
		playtype: "7K",
		url: "https://notepara.com/glassist/lnoj",
		description: "The 7K LN Overjoy table.",
		notDefault: true,
		colour: COLOUR_SET.vibrantPink,
	},
	{
		name: "Luminous",
		prefix: "ln",
		asciiPrefix: "luminous",
		playtype: "7K",
		url: "https://ladymade-star.github.io/luminous/",
		description: "The 7K Luminous Table. This is an alternative to the mainline LN tables.",
		notDefault: true,
		colour: COLOUR_SET.purple,
	},
	{
		name: "Gachimjoy",
		prefix: "双",
		asciiPrefix: "gachimjoy",
		playtype: "7K",
		url: "http://su565fx.web.fc2.com/Gachimijoy/gachimijoy.html",
		notDefault: true,
		description:
			"Gachimjoy is a gachi practice table. 双1 is approximately equivalent to an ★★1",
	},
	{
		name: "delayjoy",
		asciiPrefix: "delayjoy",

		// these trailing slashes are important. keep them.
		url: "https://lets-go-time-hell.github.io/Delay-joy-table/",
		playtype: "7K",
		prefix: "dl",
		notDefault: true,
		description:
			"Delayjoy is a delay practice table. dl0 is approximately equivalent to an st0",
	},
	{
		name: "Arm Shougakkou",
		asciiPrefix: "armShougakkou",
		url: "https://lets-go-time-hell.github.io/Arm-Shougakkou-table/",
		playtype: "7K",
		prefix: "Ude",
		notDefault: true,
		description:
			"The Arm-Shougakkou table is A gachi and gachi-ish practice table, Ude0 is approximately equivalent to an sl0",
	},
	{
		name: "Exoplanet",
		asciiPrefix: "exoplanet",
		url: "https://stellabms.xyz/fr/table.html",
		playtype: "7K",
		prefix: "fr",
		notDefault: true,
		description:
			"Exoplanet is a table by the stella/satellite maintainers with less rules on what can be submitted. Includes gimmick charts.",
	},
	{
		name: "DP Library",
		asciiPrefix: "dpLibrary",
		url: "https://yaruki0.net/DPlibrary/",
		playtype: "14K",
		prefix: "☆",
		notDefault: true,
		description: "A huge collection of Normal-Scale 14K charts.",
	},
	{
		name: "Dystopia",
		playtype: "7K",
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
		playtype: "7K",
		description: "The Scramble table, a 7k scratch table",
		url: "https://egret9.github.io/Scramble/",
		colour: COLOUR_SET.vibrantOrange,
	},
	{
		name: "Supernova",
		asciiPrefix: "supernova",
		url: "https://stellabms.xyz/sn/table.html",
		playtype: "7K",
		prefix: "sn",
		description:
			"Supernova, Stellaverse's alternative table for Insane1-esque charts. Follows the Stella table in difficulty.",
	},
	{
		name: "Solar",
		asciiPrefix: "solar",
		url: "https://stellabms.xyz/so/table.html",
		playtype: "7K",
		prefix: "so",
		description:
			"Solar, Stellaverse's alternative table for Insane1-esque charts. Follows the Satellite table in difficulty.",
	},
	{
		name: "Code Stream (st)",
		asciiPrefix: "csst",
		url: "https://air-afother.github.io/chordstream-table-split/chordstreamST.html",
		playtype: "7K",
		prefix: "重発狂",
		description: "16th Chordstream table, st0+ difficulty",
	},
	{
		name: "Code Stream (sl)",
		asciiPrefix: "cssl",
		url: "https://air-afother.github.io/chordstream-table-split/chordstream.html",
		playtype: "7K",
		prefix: "乱打",
		description: "16th Chordstream table, sl0-sl12 difficulty",
	},
];
