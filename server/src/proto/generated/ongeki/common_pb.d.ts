// package: mythos.ongeki.v0
// file: ongeki/common.proto

import * as jspb from "google-protobuf";

export interface OngekiLevelMap {
  ONGEKI_LEVEL_UNSPECIFIED: 0;
  ONGEKI_LEVEL_BASIC: 1;
  ONGEKI_LEVEL_ADVANCED: 2;
  ONGEKI_LEVEL_EXPERT: 3;
  ONGEKI_LEVEL_MASTER: 4;
  ONGEKI_LEVEL_LUNATIC: 5;
}

export const OngekiLevel: OngekiLevelMap;

export interface OngekiRankingTypeMap {
  ONGEKI_RANKING_TYPE_UNSPECIFIED: 0;
  ONGEKI_RANKING_TYPE_TECH_SCORE: 1;
  ONGEKI_RANKING_TYPE_BATTLE_SCORE: 2;
  ONGEKI_RANKING_TYPE_OVER_DAMAGE: 3;
  ONGEKI_RANKING_TYPE_PLATINUM_SCORE: 4;
}

export const OngekiRankingType: OngekiRankingTypeMap;

export interface OngekiTechScoreRankMap {
  ONGEKI_TECH_SCORE_RANK_UNSPECIFIED: 0;
  ONGEKI_TECH_SCORE_RANK_D: 1;
  ONGEKI_TECH_SCORE_RANK_C: 2;
  ONGEKI_TECH_SCORE_RANK_B: 3;
  ONGEKI_TECH_SCORE_RANK_BB: 4;
  ONGEKI_TECH_SCORE_RANK_BBB: 5;
  ONGEKI_TECH_SCORE_RANK_A: 6;
  ONGEKI_TECH_SCORE_RANK_AA: 7;
  ONGEKI_TECH_SCORE_RANK_AAA: 8;
  ONGEKI_TECH_SCORE_RANK_S: 9;
  ONGEKI_TECH_SCORE_RANK_S_PLUS: 10;
  ONGEKI_TECH_SCORE_RANK_SS: 11;
  ONGEKI_TECH_SCORE_RANK_SS_PLUS: 12;
  ONGEKI_TECH_SCORE_RANK_SSS: 13;
  ONGEKI_TECH_SCORE_RANK_SSS_PLUS: 14;
}

export const OngekiTechScoreRank: OngekiTechScoreRankMap;

export interface OngekiBattleScoreRankMap {
  ONGEKI_BATTLE_SCORE_RANK_UNSPECIFIED: 0;
  ONGEKI_BATTLE_SCORE_RANK_NO_GOOD: 1;
  ONGEKI_BATTLE_SCORE_RANK_USUALLY: 2;
  ONGEKI_BATTLE_SCORE_RANK_GOOD: 3;
  ONGEKI_BATTLE_SCORE_RANK_GREAT: 4;
  ONGEKI_BATTLE_SCORE_RANK_EXCELLENT: 5;
  ONGEKI_BATTLE_SCORE_RANK_UNBELIEVABLE: 6;
}

export const OngekiBattleScoreRank: OngekiBattleScoreRankMap;

export interface OngekiClearStatusMap {
  ONGEKI_CLEAR_STATUS_UNSPECIFIED: 0;
  ONGEKI_CLEAR_STATUS_FAILED: 1;
  ONGEKI_CLEAR_STATUS_CLEARED: 2;
  ONGEKI_CLEAR_STATUS_OVER_DAMAGE: 3;
}

export const OngekiClearStatus: OngekiClearStatusMap;

export interface OngekiComboStatusMap {
  ONGEKI_COMBO_STATUS_UNSPECIFIED: 0;
  ONGEKI_COMBO_STATUS_NONE: 1;
  ONGEKI_COMBO_STATUS_FULL_COMBO: 2;
  ONGEKI_COMBO_STATUS_ALL_BREAK: 3;
}

export const OngekiComboStatus: OngekiComboStatusMap;

export interface OngekiBossAttributeMap {
  ONGEKI_BOSS_ATTRIBUTE_UNSPECIFIED: 0;
  ONGEKI_BOSS_ATTRIBUTE_FIRE: 1;
  ONGEKI_BOSS_ATTRIBUTE_AQUA: 2;
  ONGEKI_BOSS_ATTRIBUTE_LEAF: 3;
}

export const OngekiBossAttribute: OngekiBossAttributeMap;

