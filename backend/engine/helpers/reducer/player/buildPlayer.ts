import type { Player } from "@shared/types/game";
import { generatePlayerId } from "../../generatePlayerId";

export const buildPlayer = (name: string): Player => ({
  id: generatePlayerId(),
  name,
  type: "human",
  presence: {
    connected: true,
    lastSeenAt: Date.now(),
    away: false,
  },
  controller: "human",
});
