import { GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

import type { DynamoDBClient} from "@aws-sdk/client-dynamodb";
import type { z, ZodSchema } from "zod";
import { NotFoundItem } from "./errors";

type AnyPrimitive = string | number | boolean;

type IntersectKeys<T, Keys extends (keyof T)[]> = {
  [K in Keys[number]]: T[K];
};

export interface ZordomConfig<T extends string, U extends string> {
  hash: T;
  range?: U;
  tableName: string;
}

export class Zordom<T extends string, U extends string, S extends ZodSchema<any>> {
    private config: ZordomConfig<T, U>;

    private client: DynamoDBClient;

    private schema: S;

  constructor(client: DynamoDBClient, schema: S, config: ZordomConfig<T, U>) {
    this.client = client;
    this.config = config;
    this.schema = schema;
  }

  async find<PA extends (keyof z.infer<S>)[]>(
    query: { [K in T]: AnyPrimitive } & (U extends undefined ? {} : { [P in U]: AnyPrimitive }),
    projectionAttributes?: PA
  ): Promise<PA extends undefined ? z.infer<S> : IntersectKeys<z.infer<S>, PA>> {
    const queryKey = Object.keys(query)[0] as T;
    if (queryKey !== this.config.hash) {
      throw new Error("Invalid key in query.");
    }

    if (this.config.range && !query[this.config.range]) {
      throw new Error(`Missing range in query for key ${this.config.range}.`);
    }

    let projectionExpression: string | undefined;

    if (projectionAttributes && projectionAttributes.length > 0) {
      projectionExpression = projectionAttributes.join(', ');
    }

    const Key = marshall({
      [this.config.hash]: query[queryKey],
    });

    const getItemCommand = new GetItemCommand({
      Key,
      ProjectionExpression: projectionExpression,
      TableName: this.config.tableName,
    });

    const result = await this.client.send(getItemCommand);
    const item = result.Item;

    if (!item) {
      throw new NotFoundItem(this.config.tableName, Key);
    }

    const unmarshalledItem = unmarshall(item);
    return this.schema.parse(unmarshalledItem);
  }

  async save(data: z.infer<S>): Promise<z.infer<S>> {
    const validatedData = this.schema.parse(data);
    const marshalledData = marshall(validatedData);

    const putItemCommand = new PutItemCommand({
      Item: marshalledData,
      TableName: this.config.tableName,
    });

    await this.client.send(putItemCommand);
    return validatedData;
  }

  async update(query: { [K in T]: any } & (U extends undefined ? {} : { [P in U]: any }), updateData: Partial<z.infer<S>>): Promise<z.infer<S>> {
    const queryKey = Object.keys(query)[0] as T;
    if (queryKey !== this.config.hash) {
      throw new Error("Invalid key in query.");
    }

    const validatedUpdateData = this.schema.parse(updateData);
    const marshalledUpdateData = marshall(validatedUpdateData);

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    let updateExpression = "SET ";

    for (const key in marshalledUpdateData) {
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = marshalledUpdateData[key];

      updateExpression += `#${key} = :${key}, `;
    }

    updateExpression = updateExpression.slice(0, -2); // Remove trailing comma and space

    const updateItemCommand = new UpdateItemCommand({
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Key: {
        [this.config.hash]: { S: query[queryKey] },
      },
      ReturnValues: "ALL_NEW",
      TableName: this.config.tableName,
      UpdateExpression: updateExpression,
    });

    const result = await this.client.send(updateItemCommand);
    const updatedItem = result.Attributes;

    if (!updatedItem) {
      throw new Error("Update did not return the updated item.");
    }

    const unmarshalledUpdatedItem = unmarshall(updatedItem);
    return this.schema.parse(unmarshalledUpdatedItem);
  }


  async remove(query: { [K in T]: AnyPrimitive } & (U extends undefined ? {} : { [P in U]: AnyPrimitive })): Promise<void> {
    const queryKey = Object.keys(query)[0] as T;
    if (queryKey !== this.config.hash) {
      throw new Error("Invalid key in query.");
    }

    const deleteItemCommand = new DeleteItemCommand({
      Key: marshall({
        [this.config.hash]: query[queryKey],
      }),
      TableName: this.config.tableName,
    });

    await this.client.send(deleteItemCommand);
  }
}
