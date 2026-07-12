/**
 * Given a type Array<T> or ReadonlyArray<T>, return T.
 */
export type ExtractArrayElementType<R> = R extends ReadonlyArray<infer V> ? V : never;

export type AllFieldsNullableOptional<R extends Record<string, unknown>> = {
	[K in keyof R]?: R[K] | null;
};
