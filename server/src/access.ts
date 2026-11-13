import { SetMetadata } from "@nestjs/common";

export type Role = "customer" | "admin";
export const ROLE_KEY = "hudle:roles";
export const PUBLIC_KEY = "hudle:public";
export const Roles = (...roles: Role[]) => SetMetadata(ROLE_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);
