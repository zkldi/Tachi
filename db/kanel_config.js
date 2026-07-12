const kanel = require("kanel");
const { makeKyselyHook } = require("kanel-kysely");
const path = require("path");

module.exports = {
	customTypeMap: {
		"pg_catalog.bytea": "string",
		"pg_catalog.int2": "number",
		"pg_catalog.int4": "number",
		"pg_catalog.int8": "number",
		"pg_catalog.timestamptz": "string",
		"pg_catalog.tsvector": "string",
	},
	enumStyle: "type",
	generateIdentifierType: (column, details, config) => {
		const name = kanel.escapeIdentifier(details.name + "_" + column.name);

		const configWithoutGenerateIdentifierType = { ...config };
		delete configWithoutGenerateIdentifierType.generateIdentifierType;

		const innerType = kanel.resolveType(column, details, configWithoutGenerateIdentifierType);

		return {
			comment: [`Identifier type for ${details.schemaName}.${details.name}`],
			declarationType: "typeDeclaration",
			exportAs: "named",
			name,
			typeDefinition: [typeof innerType === "string" ? innerType : innerType.name],
			typeImports: typeof innerType === "string" ? [] : innerType.typeImports,
		};
	},
	outputPath: path.join(__dirname, "../typescript/db/src/generated"),
	preRenderHooks: [makeKyselyHook(), kanel.generateIndexFile],
	resolveViews: true,
};
