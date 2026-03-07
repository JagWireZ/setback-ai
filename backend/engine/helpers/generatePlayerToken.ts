export const generatePlayerToken = (): string => {
  return crypto.randomUUID();
};
