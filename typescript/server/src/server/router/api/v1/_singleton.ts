// this is a hack to avoid circular imports - zk

import { TypedRouter } from "#lib/router/typed-router";

import { API_V1_SPEC } from "./spec";

export const API_V1_ROUTER = new TypedRouter(API_V1_SPEC);
