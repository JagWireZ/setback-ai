import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

type DynamoKey = Record<string, unknown>;

type PutItemParams<TItem extends Record<string, unknown>> = {
  tableName: string;
  item: TItem;
};

type PutPartialItemParams<TItem extends Record<string, unknown>> = {
  tableName: string;
  key: DynamoKey;
  updates: Partial<TItem>;
};

type GetItemParams = {
  tableName: string;
  key: DynamoKey;
};

type DeleteItemParams = {
  tableName: string;
  key: DynamoKey;
};

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const PutItem = async <TItem extends Record<string, unknown>>(
  params: PutItemParams<TItem>,
): Promise<void> => {
  const { tableName, item } = params;

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );
};

export const PutPartialItem = async <TItem extends Record<string, unknown>>(
  params: PutPartialItemParams<TItem>,
): Promise<TItem | undefined> => {
  const { tableName, key, updates } = params;

  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    throw new Error("PutPartialItem requires at least one defined update field");
  }

  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  const setClauses = entries.map(([field, value], index) => {
    const nameToken = `#f${index}`;
    const valueToken = `:v${index}`;

    expressionAttributeNames[nameToken] = field;
    expressionAttributeValues[valueToken] = value;

    return `${nameToken} = ${valueToken}`;
  });

  const result = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${setClauses.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }),
  );

  return result.Attributes as TItem | undefined;
};

export const GetItem = async <TItem extends Record<string, unknown>>(
  params: GetItemParams,
): Promise<TItem | undefined> => {
  const { tableName, key } = params;

  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
    }),
  );

  return result.Item as TItem | undefined;
};

export const DeleteItem = async (
  params: DeleteItemParams,
): Promise<void> => {
  const { tableName, key } = params;

  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: key,
    }),
  );
};
