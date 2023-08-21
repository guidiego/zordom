export class InvalidKey extends Error {
  constructor(tableName: string, key: string, query: Record<string, AnyPrimitive>) {
    super(`You not provide the right key, expect ${key} get ${JSON.stringify(query)} DynamoDB ${tableName} table`)
  }
}
