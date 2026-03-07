export const generatePlayerId = (): string => {
  return crypto.randomUUID().slice(0, 8);
};
