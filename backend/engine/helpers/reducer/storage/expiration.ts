import type { Game } from "@shared/types/game";

export const GAME_TTL_SECONDS = 3 * 24 * 60 * 60;

export type ExpiringItem = {
  expiresAt: number;
};

export type GameStorageItem = Game & ExpiringItem;

export const buildExpiresAt = (nowMs = Date.now()): number =>
  Math.floor(nowMs / 1000) + GAME_TTL_SECONDS;

export const isExpired = (expiresAt: number, nowMs = Date.now()): boolean =>
  expiresAt <= Math.floor(nowMs / 1000);

export const withExpiration = <TItem extends Record<string, unknown>>(
  item: TItem,
  nowMs = Date.now(),
): TItem & ExpiringItem => ({
  ...item,
  expiresAt: buildExpiresAt(nowMs),
});
