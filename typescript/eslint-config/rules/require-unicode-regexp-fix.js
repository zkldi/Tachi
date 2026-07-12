/**
 * Same behavior as ESLint core `require-unicode-regexp`, but applies the `u` / `v` flag
 * via autofix (`--fix`). Core exposes the equivalent only as suggestions.
 */

/** @import { Rule } from "eslint" */

import {
	CALL,
	CONSTRUCT,
	ReferenceTracker,
	getStringIfConstant,
	isCommaToken,
} from "@eslint-community/eslint-utils";
import { RegExpValidator } from "@eslint-community/regexpp";

const REGEXPP_LATEST_ECMA_VERSION = 2025;

/** @typedef {"u"|"v"|undefined} RequireFlagOption */

/**
 * @param {unknown} ecmaVersion
 */
function normalizeEcmaVersion(ecmaVersion) {
	return typeof ecmaVersion === "number" && Number.isFinite(ecmaVersion)
		? ecmaVersion
		: REGEXPP_LATEST_ECMA_VERSION;
}

/**
 * @param {RequireFlagOption} requireFlag
 * @param {string} flags
 */
function checkFlags(requireFlag, flags) {
	if (requireFlag === "v") {
		return !flags.includes("v");
	}
	if (requireFlag === "u") {
		return !flags.includes("u");
	}
	return !flags.includes("u") && !flags.includes("v");
}

/**
 * Same contract as eslint/lib/rules/utils/regular-expressions.js
 *
 * @param {unknown} ecmaVersion Raw `languageOptions.ecmaVersion`
 * @param {string} pattern
 * @param {"u"|"v"} flag
 */
function isValidWithUnicodeFlag(ecmaVersion, pattern, flag = "u") {
	const normalized = normalizeEcmaVersion(ecmaVersion);
	if (flag === "u" && normalized <= 5) {
		return false;
	}
	if (flag === "v" && normalized <= 2023) {
		return false;
	}

	const validator = new RegExpValidator({
		ecmaVersion: Math.min(normalized, REGEXPP_LATEST_ECMA_VERSION),
	});

	try {
		validator.validatePattern(
			pattern,
			void 0,
			void 0,
			flag === "u"
				? {
						unicode: true,
					}
				: {
						unicodeSets: true,
					},
		);
	} catch {
		return false;
	}

	return true;
}

/** @type {Rule.RuleModule} */
export const requireUnicodeRegexpFix = {
	meta: {
		type: "suggestion",

		defaultOptions: [{}],

		docs: {
			description:
				"Enforce the use of `u` or `v` flag on regular expressions (same checks as ESLint core; autofix inserts the chosen flag)",
		},

		fixable: "code",

		messages: {
			requireUFlag: "Use the 'u' flag.",
			requireVFlag: "Use the 'v' flag.",
		},

		schema: [
			{
				type: "object",
				properties: {
					requireFlag: {
						enum: ["u", "v"],
					},
				},
				additionalProperties: false,
			},
		],
	},

	create(context) {
		const sourceCode = /** @type {import("eslint").SourceCode} */ (
			context.sourceCode ?? context.getSourceCode?.()
		);
		if (!sourceCode?.getScope) {
			throw new Error("eslint-config-tachi: sourceCode unavailable on ESLint rule context");
		}

		/** @type {[{ requireFlag?: "u"|"v" }]} */
		const [{ requireFlag }] = context.options;

		return {
			"Literal[regex]"(node) {
				const flagsText = node.regex.flags ?? "";

				if (!checkFlags(requireFlag, flagsText)) {
					return;
				}

				context.report({
					messageId:
						requireFlag === "v"
							? /** @type {"requireVFlag"|"requireUFlag"} */
								"requireVFlag"
							: "requireUFlag",
					node,
					fix: isValidWithUnicodeFlag(
						context.languageOptions.ecmaVersion,
						node.regex.pattern,
						requireFlag ?? "u",
					)
						? (fixer) => fixRegexLiteral(fixer, sourceCode, node, requireFlag)
						: null,
				});
			},

			Program(node) {
				const scope = /** @type {import("eslint").Scope.Scope} */ (
					sourceCode.getScope(node)
				);

				const tracker = new ReferenceTracker(scope);
				const trackMap = { RegExp: { [CALL]: true, [CONSTRUCT]: true } };

				for (const { node: refNode } of tracker.iterateGlobalReferences(trackMap)) {
					const [patternNode, flagsNode] = refNode.arguments;

					if (patternNode && patternNode.type === "SpreadElement") {
						continue;
					}

					const pattern = getStringIfConstant(patternNode, scope);
					const flags = flagsNode ? getStringIfConstant(flagsNode, scope) : undefined;

					let missingFlag = !flagsNode;

					if (typeof flags === "string") {
						missingFlag = checkFlags(requireFlag, flags);
					}

					if (!missingFlag) {
						continue;
					}

					const canFixPattern =
						typeof pattern === "string" &&
						isValidWithUnicodeFlag(
							context.languageOptions.ecmaVersion,
							pattern,
							requireFlag ?? "u",
						);

					context.report({
						messageId:
							requireFlag === "v"
								? /** @type {"requireVFlag"|"requireUFlag"} */
									"requireVFlag"
								: "requireUFlag",
						node: refNode,
						fix: canFixPattern
							? (fixer) =>
									fixGlobalRegExpCall(
										fixer,
										sourceCode,
										refNode,
										flagsNode,
										flags ?? "",
										requireFlag,
									)
							: null,
					});
				}
			},
		};
	},
};

/**
 * @param {Rule.RuleFixer} fixer
 * @param {import("eslint").SourceCode} sourceCode
 * @param {Rule.Node} node
 * @param {RequireFlagOption} requireFlag
 */
function fixRegexLiteral(fixer, sourceCode, node, requireFlag) {
	const replaceFlag = requireFlag ?? "u";
	const regexText = sourceCode.getText(node);
	const slashPos = regexText.lastIndexOf("/");

	if (requireFlag) {
		const conflicting = requireFlag === "u" /** @type {"u"|"v"} */ ? "v" : "u";
		if (regexText.includes(conflicting, slashPos)) {
			return fixer.replaceText(
				node,
				regexText.slice(0, slashPos) +
					regexText.slice(slashPos).replace(conflicting, requireFlag),
			);
		}
	}

	return fixer.insertTextAfter(node, replaceFlag);
}

/**
 * Mirrors ESLint `require-unicode-regexp` suggestion logic for constructor calls (as autofix).
 *
 * @param {Rule.RuleFixer} fixer
 * @param {import("eslint").SourceCode} sourceCode
 * @param {Rule.Node & { callee: unknown; arguments: import("eslint").Rule.Node[] }} refNode
 * @param {import("estree").Expression | SpreadElement | undefined} flagsNode
 * @param {string} flags Resolved constant flags when determinable (`""` if omitted)
 * @param {RequireFlagOption} requireFlag
 */
function fixGlobalRegExpCall(fixer, sourceCode, refNode, flagsNode, flags, requireFlag) {
	const replaceFlag =
		requireFlag ??
		/** @type {"u"|"v"} */
		("u");

	if (flagsNode) {
		if (
			(flagsNode.type === "Literal" && typeof flagsNode.value === "string") ||
			flagsNode.type === "TemplateLiteral"
		) {
			const flagsNodeText = sourceCode.getText(flagsNode);

			const conflicting = requireFlag === "u" ? "v" : "u";
			if (requireFlag && flags.includes(conflicting)) {
				if (
					flagsNode.type === "Literal" &&
					typeof flagsNode.raw === "string" &&
					flagsNode.raw.includes("\\")
				) {
					return null;
				}
				if (
					flagsNode.type === "TemplateLiteral" &&
					(flagsNode.expressions.length ||
						flagsNode.quasis.some((q) => q.value.raw.includes("\\")))
				) {
					return null;
				}

				return fixer.replaceText(
					flagsNode,
					flagsNodeText.replace(conflicting, replaceFlag),
				);
			}

			return fixer.replaceText(
				flagsNode,
				[
					flagsNodeText.slice(0, flagsNodeText.length - 1),
					flagsNodeText.slice(flagsNodeText.length - 1),
				].join(replaceFlag),
			);
		}

		return null;
	}

	const penultimateToken = sourceCode.getLastToken(refNode, { skip: 1 });
	if (!penultimateToken) {
		return null;
	}

	return fixer.insertTextAfter(
		penultimateToken,
		isCommaToken(penultimateToken) ? ` "${replaceFlag}",` : `, "${replaceFlag}"`,
	);
}
