import { MutateCollection } from "../util.js";

// This is an example SINGLE-USE script. It does something quickly and ad-hoc,
// that is of absolutely no interest to anyone else.
//
// You should treat personal as your own playground for silly one-off things.
//
//                            ---------
//                           / ZK SAYS \
// //-----------------------------------------------------------------\\
// !! PLEASE DO NOT USE SINGLE-USE FOR THINGS THAT YOU WANT TO RE-USE !!
// !! ANYTHING YOU WANT TO RE-USE SHOULD BE SHARED ON TACHI IN CASE   !!
// !! YOU LOSE IT!                                                    !!
// \\-----------------------------------------------------------------//

MutateCollection("charts-iidx.json", (charts) => {
	for (const chart of charts) {
		delete chart.whoopsBADKEY;
	}

	return charts;
});
