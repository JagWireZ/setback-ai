import type { Player } from "@shared/types/game";
import { generatePlayerId } from "../generatePlayerId";

export const buildPlayer = (name: string): Player => ({
  id: generatePlayerId(),
  name,
  type: "human",
  connected: true,
});
