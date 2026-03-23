export enum IIDX_LAMPS {
	NO_PLAY = 0,
	FAILED = 1,
	ASSIST_CLEAR = 2,
	EASY_CLEAR = 3,
	CLEAR = 4,
	HARD_CLEAR = 5,
	EX_HARD_CLEAR = 6,
	FULL_COMBO = 7,
}

export enum CHUNITHM_CLEAR_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	HARD = 2,
	BRAVE = 3,
	ABSOLUTE = 4,
	CATASTROPHY = 5,
}

export enum CHUNITHM_NOTE_LAMPS {
	NONE = 0,
	FULL_COMBO = 1,
	ALL_JUSTICE = 2,
	ALL_JUSTICE_CRITICAL = 3,
}

export enum SDVX_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	EXCESSIVE_CLEAR = 2,
	MAXXIVE_CLEAR = 3,
	ULTIMATE_CHAIN = 4,
	PERFECT_ULTIMATE_CHAIN = 5,
}

export enum USC_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	EXCESSIVE_CLEAR = 2,
	ULTIMATE_CHAIN = 3,
	PERFECT_ULTIMATE_CHAIN = 4,
}

export enum MUSECA_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	CONNECT_ALL = 2,
	PERFECT_CONNECT_ALL = 3,
}

export enum DDR_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	LIFE4 = 2,
	FULL_COMBO = 3,
	GREAT_FULL_COMBO = 4,
	PERFECT_FULL_COMBO = 5,
	MARVELOUS_FULL_COMBO = 6,
}

export enum MAIMAI_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	FULL_COMBO = 2,
	ALL_PERFECT = 3,
	ALL_PERFECT_PLUS = 4,
}

export enum MAIMAIDX_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	FULL_COMBO = 2,
	FULL_COMBO_PLUS = 3,
	ALL_PERFECT = 4,
	ALL_PERFECT_PLUS = 5,
}

export enum GITADORA_LAMPS {
	FAILED = 0,
	CLEAR = 1,
	FULL_COMBO = 2,
	EXCELLENT = 3,
}

export enum IIDX_GRADES {
	F = 0,
	E = 1,
	D = 2,
	C = 3,
	B = 4,
	A = 5,
	AA = 6,
	AAA = 7,
	MAX_MINUS = 8,
	MAX = 9,
}

export enum CHUNITHM_GRADES {
	D = 0,
	C = 1,
	B = 2,
	BB = 3,
	BBB = 4,
	A = 5,
	AA = 6,
	AAA = 7,
	S = 8,
	S_PLUS = 9,
	SS = 10,
	SS_PLUS = 11,
	SSS = 12,
	SSS_PLUS = 13,
}

export enum JUBEAT_GRADES {
	E = 0,
	D = 1,
	C = 2,
	B = 3,
	A = 4,
	S = 5,
	SS = 6,
	SSS = 7,
}

export enum SDVX_GRADES {
	D = 0,
	C = 1,
	B = 2,
	A = 3,
	A_PLUS = 4,
	AA = 5,
	AA_PLUS = 6,
	AAA = 7,
	AAA_PLUS = 8,
	S = 9,
}

export enum MUSECA_GRADES {
	没 = 0,
	拙 = 1,
	凡 = 2,
	佳 = 3,
	良 = 4,
	優 = 5,
	秀 = 6,
	傑 = 7,
	傑G = 8,
}

/**
 * Kxxx refers to the starting point of that grade,
 * since they dont translate to english well.
 * K950 means the grade that starts at 950K and goes
 * to 975K.
 */
export const MUSECA_GRADES_ASCII = {
	ZERO: "没",
	K600: "拙",
	K700: "凡",
	K800: "佳",
	K850: "良",
	K900: "優",
	K950: "秀",
	K975: "傑",
	K1000: "傑G",
};

export enum DDR_GRADES {
	D = 0,
	D_PLUS = 1,
	C_MINUS = 2,
	C = 3,
	C_PLUS = 4,
	B_MINUS = 5,
	B = 6,
	B_PLUS = 7,
	A_MINUS = 8,
	A = 9,
	A_PLUS = 10,
	AA_MINUS = 11,
	AA = 12,
	AA_PLUS = 13,
	AAA = 14,
}

export enum GITADORA_GRADES {
	C = 0,
	B = 1,
	A = 2,
	S = 3,
	SS = 4,
	MAX = 5,
}

export enum IIDX_DANS {
	KYU_7 = 0,
	KYU_6 = 1,
	KYU_5 = 2,
	KYU_4 = 3,
	KYU_3 = 4,
	KYU_2 = 5,
	KYU_1 = 6,

	DAN_1 = 7,
	DAN_2 = 8,
	DAN_3 = 9,
	DAN_4 = 10,
	DAN_5 = 11,
	DAN_6 = 12,
	DAN_7 = 13,
	DAN_8 = 14,
	DAN_9 = 15,
	DAN_10 = 16,

	CHUUDEN = 17,
	KAIDEN = 18,
}

export enum GITADORA_COLOURS {
	WHITE = 0,

	ORANGE = 1,
	ORANGE_GRADIENT = 2,
	YELLOW = 3,
	YELLOW_GRADIENT = 4,
	GREEN = 5,
	GREEN_GRADIENT = 6,
	BLUE = 7,
	BLUE_GRADIENT = 8,
	PURPLE = 9,
	PURPLE_GRADIENT = 10,
	RED = 11,
	RED_GRADIENT = 12,

	BRONZE = 13,
	SILVER = 14,
	GOLD = 15,
	RAINBOW = 16,
}

export enum BMS_GENOCIDE_DANS {
	NORMAL_1 = 0,
	NORMAL_2 = 1,
	NORMAL_3 = 2,
	NORMAL_4 = 3,
	NORMAL_5 = 4,
	NORMAL_6 = 5,
	NORMAL_7 = 6,
	NORMAL_8 = 7,
	NORMAL_9 = 8,
	NORMAL_10 = 9,

	INSANE_1 = 10,
	INSANE_2 = 11,
	INSANE_3 = 12,
	INSANE_4 = 13,
	INSANE_5 = 14,
	INSANE_6 = 15,
	INSANE_7 = 16,
	INSANE_8 = 17,
	INSANE_9 = 18,
	INSANE_10 = 19,
	INSANE_KAIDEN = 20,

	OVERJOY = 21,
}

export enum BMS_STSL_DANS {
	SL_0 = 0,
	SL_1 = 1,
	SL_2 = 2,
	SL_3 = 3,
	SL_4 = 4,
	SL_5 = 5,
	SL_6 = 6,
	SL_7 = 7,
	SL_8 = 8,
	SL_9 = 9,
	SL_10 = 10,
	SL_11 = 11,
	SL_12 = 12,

	ST_0 = 13,
	ST_1 = 14,
	ST_2 = 15,
	ST_3 = 16,
	ST_4 = 17,
	ST_5 = 18,
	ST_6 = 19,
	ST_7 = 20,
	ST_8 = 21,
	ST_9 = 22,
	ST_10 = 23,
	ST_11 = 24,
	ST_12 = 25,
}

export enum PMS_INSANE_DANS {
	DAN_1 = 0,
	DAN_2 = 1,
	DAN_3 = 2,
	DAN_4 = 3,
	DAN_5 = 4,
	DAN_6 = 5,
	DAN_7 = 6,
	DAN_8 = 7,
	DAN_9 = 8,
	DAN_10 = 9,
	KAIDEN = 10,
	OVERJOY = 11,
	UNDEFINED = 12,
}

export enum SDVX_DANS {
	DAN_1 = 0,
	DAN_2 = 1,
	DAN_3 = 2,
	DAN_4 = 3,
	DAN_5 = 4,
	DAN_6 = 5,
	DAN_7 = 6,
	DAN_8 = 7,
	DAN_9 = 8,
	DAN_10 = 9,
	DAN_11 = 10,
	INF = 11,
}

// ewww
export enum SDVX_VF_CLASSES {
	SIENNA_I = 0,
	SIENNA_II = 1,
	SIENNA_III = 2,
	SIENNA_IV = 3,
	COBALT_I = 4,
	COBALT_II = 5,
	COBALT_III = 6,
	COBALT_IV = 7,
	DANDELION_I = 8,
	DANDELION_II = 9,
	DANDELION_III = 10,
	DANDELION_IV = 11,
	CYAN_I = 12,
	CYAN_II = 13,
	CYAN_III = 14,
	CYAN_IV = 15,
	SCARLET_I = 16,
	SCARLET_II = 17,
	SCARLET_III = 18,
	SCARLET_IV = 19,
	CORAL_I = 20,
	CORAL_II = 21,
	CORAL_III = 22,
	CORAL_IV = 23,
	ARGENTO_I = 24,
	ARGENTO_II = 25,
	ARGENTO_III = 26,
	ARGENTO_IV = 27,
	ELDORA_I = 28,
	ELDORA_II = 29,
	ELDORA_III = 30,
	ELDORA_IV = 31,
	CRIMSON_I = 32,
	CRIMSON_II = 33,
	CRIMSON_III = 34,
	CRIMSON_IV = 35,
	IMPERIAL_I = 36,
	IMPERIAL_II = 37,
	IMPERIAL_III = 38,
	IMPERIAL_IV = 39,
}

export enum CHUNITHM_COLOURS {
	BLUE = 0,
	GREEN = 1,
	ORANGE = 2,
	RED = 3,
	PURPLE = 4,
	BRONZE = 5,
	SILVER = 6,
	GOLD = 7,
	PLATINUM = 8,
	RAINBOW = 9,
}

export enum WACCA_STAGEUPS {
	I = 0,
	II = 1,
	III = 2,
	IV = 3,
	V = 4,
	VI = 5,
	VII = 6,
	VIII = 7,
	IX = 8,
	X = 9,
	XI = 10,
	XII = 11,
	XIII = 12,
	XIV = 13,
}

export enum WACCA_COLOURS {
	ASH = 0,
	NAVY = 1,
	YELLOW = 2,
	RED = 3,
	PURPLE = 4,
	BLUE = 5,
	SILVER = 6,
	GOLD = 7,
	RAINBOW = 8,
}

export enum POPN_CLASSES {
	KITTY = 0,
	GRADE_SCHOOL = 1,
	DELINQUENT = 2,
	DETECTIVE = 3,
	IDOL = 4,
	GENERAL = 5,
	HERMIT = 6,
	GOD = 7,
}

export enum JUBEAT_COLOURS {
	BLACK = 0,
	YELLOW_GREEN = 1,
	GREEN = 2,
	LIGHT_BLUE = 3,
	BLUE = 4,
	VIOLET = 5,
	PURPLE = 6,
	PINK = 7,
	ORANGE = 8,
	GOLD = 9,
}

export enum MAIMAIDX_COLOURS {
	WHITE = 0,
	BLUE = 1,
	GREEN = 2,
	YELLOW = 3,
	RED = 4,
	PURPLE = 5,
	BRONZE = 6,
	SILVER = 7,
	GOLD = 8,
	PLATINUM = 9,
	RAINBOW = 10,
}

export enum MAIMAIDX_DANS {
	DAN_1 = 0,
	DAN_2 = 1,
	DAN_3 = 2,
	DAN_4 = 3,
	DAN_5 = 4,
	DAN_6 = 5,
	DAN_7 = 6,
	DAN_8 = 7,
	DAN_9 = 8,
	DAN_10 = 9,

	SHINSHODAN = 10,
	SHINDAN_2 = 11,
	SHINDAN_3 = 12,
	SHINDAN_4 = 13,
	SHINDAN_5 = 14,
	SHINDAN_6 = 15,
	SHINDAN_7 = 16,
	SHINDAN_8 = 17,
	SHINDAN_9 = 18,
	SHINDAN_10 = 19,

	SHINKAIDEN = 20,
	URAKAIDEN = 21,
}

export enum MAIMAIDX_GRADES {
	D = 0,
	C = 1,
	B = 2,
	BB = 3,
	BBB = 4,
	A = 5,
	AA = 6,
	AAA = 7,
	S = 8,
	S_PLUS = 9,
	SS = 10,
	SS_PLUS = 11,
	SSS = 12,
	SSS_PLUS = 13,
}

export enum MAIMAIDX_MATCHING_CLASSES {
	B5 = 0,
	B4 = 1,
	B3 = 2,
	B2 = 3,
	B1 = 4,

	A5 = 5,
	A4 = 6,
	A3 = 7,
	A2 = 8,
	A1 = 9,

	S5 = 10,
	S4 = 11,
	S3 = 12,
	S2 = 13,
	S1 = 14,

	SS5 = 15,
	SS4 = 16,
	SS3 = 17,
	SS2 = 18,
	SS1 = 19,

	SSS5 = 20,
	SSS4 = 21,
	SSS3 = 22,
	SSS2 = 23,
	SSS1 = 24,

	LEGEND = 25,
}

export enum ARCAEA_BADGES {
	BLUE = 0,
	GREEN = 1,
	ASH_PURPLE = 2,
	PURPLE = 3,
	RED = 4,
	ONE_STAR = 5,
	TWO_STARS = 6,
	THREE_STARS = 7,
}

export enum ARCAEA_GRADES {
	D = 0,
	C = 1,
	B = 2,
	A = 3,
	AA = 4,
	EX = 5,
	EX_PLUS = 6,
}

export enum ARCAEA_LAMPS {
	LOST = 0,
	EASY_CLEAR = 1,
	CLEAR = 2,
	HARD_CLEAR = 3,
	FULL_RECALL = 4,
	PURE_MEMORY = 5,
}

export enum ARCAEA_COURSE_BANNERS {
	PHASE_1 = 0,
	PHASE_2 = 1,
	PHASE_3 = 2,
	PHASE_4 = 3,
	PHASE_5 = 4,
	PHASE_6 = 5,
	PHASE_7 = 6,
	PHASE_8 = 7,
	PHASE_9 = 8,
	PHASE_10 = 9,
	PHASE_11 = 10,
}

export enum ONGEKI_NOTE_LAMPS {
	LOSS = 0,
	CLEAR = 1,
	FULL_COMBO = 2,
	ALL_BREAK = 3,
	ALL_BREAK_PLUS = 4,
}

export enum ONGEKI_BELL_LAMPS {
	NONE = 0,
	FULL_BELL = 1,
}

export enum ONGEKI_GRADES {
	D = 0,
	C = 1,
	B = 2,
	BB = 3,
	BBB = 4,
	A = 5,
	AA = 6,
	AAA = 7,
	S = 8,
	SS = 9,
	SSS = 10,
	SSS_PLUS = 11,
}

export enum ONGEKI_COLOURS {
	BLUE = 0,
	GREEN = 1,
	ORANGE = 2,
	RED = 3,
	PURPLE = 4,
	COPPER = 5,
	SILVER = 6,
	GOLD = 7,
	PLATINUM = 8,
	RAINBOW = 9,
	RAINBOW_SHINY = 10,
	RAINBOW_EX = 11,
	RAINBOW_EX_TRUE = 12,
}
