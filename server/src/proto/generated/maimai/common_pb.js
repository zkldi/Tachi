// source: maimai/common.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = (function() {
  if (this) { return this; }
  if (typeof window !== 'undefined') { return window; }
  if (typeof global !== 'undefined') { return global; }
  if (typeof self !== 'undefined') { return self; }
  return Function('return this')();
}.call(null));

goog.exportSymbol('proto.mythos.maimai.v0.MaimaiComboStatus', null, global);
goog.exportSymbol('proto.mythos.maimai.v0.MaimaiLevel', null, global);
goog.exportSymbol('proto.mythos.maimai.v0.MaimaiRankingType', null, global);
goog.exportSymbol('proto.mythos.maimai.v0.MaimaiScoreRank', null, global);
goog.exportSymbol('proto.mythos.maimai.v0.MaimaiSyncStatus', null, global);
/**
 * @enum {number}
 */
proto.mythos.maimai.v0.MaimaiRankingType = {
  MAIMAI_RANKING_TYPE_UNSPECIFIED: 0,
  MAIMAI_RANKING_TYPE_ACHIEVEMENT: 1,
  MAIMAI_RANKING_TYPE_DX_SCORE: 2
};

/**
 * @enum {number}
 */
proto.mythos.maimai.v0.MaimaiLevel = {
  MAIMAI_LEVEL_UNSPECIFIED: 0,
  MAIMAI_LEVEL_BASIC: 1,
  MAIMAI_LEVEL_ADVANCED: 2,
  MAIMAI_LEVEL_EXPERT: 3,
  MAIMAI_LEVEL_MASTER: 4,
  MAIMAI_LEVEL_REMASTER: 5,
  MAIMAI_LEVEL_UTAGE: 6
};

/**
 * @enum {number}
 */
proto.mythos.maimai.v0.MaimaiComboStatus = {
  MAIMAI_COMBO_STATUS_UNSPECIFIED: 0,
  MAIMAI_COMBO_STATUS_NONE: 1,
  MAIMAI_COMBO_STATUS_FULL_COMBO: 2,
  MAIMAI_COMBO_STATUS_FULL_COMBO_PLUS: 3,
  MAIMAI_COMBO_STATUS_ALL_PERFECT: 4,
  MAIMAI_COMBO_STATUS_ALL_PERFECT_PLUS: 5
};

/**
 * @enum {number}
 */
proto.mythos.maimai.v0.MaimaiSyncStatus = {
  MAIMAI_SYNC_STATUS_UNSPECIFIED: 0,
  MAIMAI_SYNC_STATUS_NONE: 1,
  MAIMAI_SYNC_STATUS_FULL_SYNC: 2,
  MAIMAI_SYNC_STATUS_FULL_SYNC_PLUS: 3,
  MAIMAI_SYNC_STATUS_FULL_SYNC_DX: 4,
  MAIMAI_SYNC_STATUS_FULL_SYNC_DX_PLUS: 5
};

/**
 * @enum {number}
 */
proto.mythos.maimai.v0.MaimaiScoreRank = {
  MAIMAI_SCORE_RANK_UNSPECIFIED: 0,
  MAIMAI_SCORE_RANK_D: 1,
  MAIMAI_SCORE_RANK_C: 2,
  MAIMAI_SCORE_RANK_B: 3,
  MAIMAI_SCORE_RANK_BB: 4,
  MAIMAI_SCORE_RANK_BBB: 5,
  MAIMAI_SCORE_RANK_A: 6,
  MAIMAI_SCORE_RANK_AA: 7,
  MAIMAI_SCORE_RANK_AAA: 8,
  MAIMAI_SCORE_RANK_S: 9,
  MAIMAI_SCORE_RANK_S_PLUS: 10,
  MAIMAI_SCORE_RANK_SS: 11,
  MAIMAI_SCORE_RANK_SS_PLUS: 12,
  MAIMAI_SCORE_RANK_SSS: 13,
  MAIMAI_SCORE_RANK_SSS_PLUS: 14
};

goog.object.extend(exports, proto.mythos.maimai.v0);
