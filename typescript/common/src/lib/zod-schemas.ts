import z from "zod";

import { ALL_PERMISSIONS } from "../constants/permissions";

export const zodPermission = z.enum(Object.keys(ALL_PERMISSIONS));
