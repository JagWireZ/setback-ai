export const tableName = (): string => {
  const value =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.DYNAMODB_TABLE_NAME;

  if (!value) {
    throw new Error("Missing DYNAMODB_TABLE_NAME");
  }

  return value;
};
