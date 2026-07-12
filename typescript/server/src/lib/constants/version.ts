import { Env } from "#lib/setup/config";

export const VERSION_STR = Env.VERSION;
export const VERSION_PRETTY = `v${Env.VERSION} [${Env.VERSION_DETAIL}]`;
