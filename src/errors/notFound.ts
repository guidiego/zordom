import type { AttributeValue } from "@aws-sdk/client-dynamodb";

export class NotFoundItem extends Error {
  constructor(tableName: string, query: Record<string, AttributeValue>) {
    super(`Not found item for Keys(${JSON.stringify(query)}) in DynamoDB ${tableName} table`)
  }
}
