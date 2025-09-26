import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import type { KeyValueStore } from './keyValueStore.ts';

const region = process.env.AWS_REGION;
const tableName = process.env.DYNAMODB_TABLE_NAME;
const primaryKey = process.env.DYNAMODB_PRIMARY_KEY || 'id';

let dynamoClient: DynamoDBClient | null = null;

const getDynamoClient = (): DynamoDBClient => {
  if (!dynamoClient) {
    if (!region || !tableName) {
      throw new Error("AWS environment variables (AWS_REGION, DYNAMODB_TABLE_NAME) are not set.");
    }
    dynamoClient = new DynamoDBClient({ region });
  }
  return dynamoClient;
};

/**
 * Creates a KeyValueStore implementation backed by AWS DynamoDB.
 */
export const createAwsDynamoDBStore = (): KeyValueStore => {
  const client = getDynamoClient();

  return {
    async get(key: string): Promise<string | null> {
      const command = new GetItemCommand({
        TableName: tableName,
        Key: {
          [primaryKey]: { S: key }
        },
      });
      const result = await client.send(command);
      // Also check if TTL has expired
      if (result.Item?.ttl && Number(result.Item.ttl.N) < Math.floor(Date.now() / 1000)) {
          return null;
      }
      return result.Item?.value?.S || null;
    },
    async set(key: string, value: string, options?: { EX: number }): Promise<void> {
      const item: any = {
        [primaryKey]: { S: key },
        value: { S: value }
      };

      if (options?.EX) {
        // DynamoDB TTL attribute must be a Unix timestamp in seconds.
        const expirationTime = Math.floor(Date.now() / 1000) + options.EX;
        item.ttl = { N: expirationTime.toString() };
      }

      const command = new PutItemCommand({
        TableName: tableName,
        Item: item,
      });
      await client.send(command);
    },
    async del(key: string): Promise<void> {
      const command = new DeleteItemCommand({
        TableName: tableName,
        Key: {
          [primaryKey]: { S: key }
        },
      });
      await client.send(command);
    },
    async exists(key: string): Promise<boolean> {
      const value = await this.get(key);
      return value !== null;
    },
  };
};