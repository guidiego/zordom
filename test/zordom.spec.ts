
import { DeleteItemCommand, GetItemCommand, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { z } from "zod";
import { marshall } from "@aws-sdk/util-dynamodb";

import { Zordom } from '../src/zordom';
import { InvalidKey, NotFoundItem } from "../src/errors";

import type { AttributeValue, DynamoDBClient} from "@aws-sdk/client-dynamodb";

jest.mock("@aws-sdk/client-dynamodb");

const fakeCmd = (cmd: string) => ({ cmd });

describe('src/zordom', () => {
  const dynamo = { send: jest.fn() };
  const hash = 'id';
  const range = 'owner';
  const tableName = 'notes';
  const noteSchema = z.object({
    completed: z.boolean(),
    [hash]: z.string(),
    [range]: z.string(),
    text: z.string(),
  });

  const config = { hash, tableName };
  const configWithRange = { ...config, range };

  const noteSample = {
    completed: false,
    id: '123',
    owner: '@guidiego',
    text: 'Hello Zordom!',
  }

  const getCommand = (hashValue: string, projectionExpression?: string) => ({
    Key: marshall({
      [hash]: hashValue,
    }),
    ProjectionExpression: projectionExpression,
    TableName: tableName,
  })

  const putCommand = (data: z.infer<typeof noteSchema>) => ({
    Item: marshall(data),
    TableName: tableName,
  })

  const updateCommand = (
    query: Record<string, AnyPrimitive>,
    ExpressionAttributeNames: Record<string, string>,
    ExpressionAttributeValues: Record<string, AttributeValue>,
    UpdateExpression: string,
  ) => ({
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    Key: marshall(query),
    ReturnValues: "ALL_NEW",
    TableName: tableName,
    UpdateExpression,
  })

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('find method', () => {
    beforeEach(() => {
      (GetItemCommand as unknown as jest.Mock).mockImplementation(() => fakeCmd('get'));
    })

    it('should retrieve an item from the database only with hash', async () => {
      dynamo.send.mockResolvedValue({ Item: marshall(noteSample) });

      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);
      const result = await zordom.find({ id });

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).toHaveBeenCalledTimes(1);
      expect(GetItemCommand).toHaveBeenCalledWith(getCommand(id))
      expect(result).toStrictEqual(noteSample);
    });

    it('should retrieve an item from the database only with hash and with project fields', async () => {
      const smallSample = { completed: false };
      dynamo.send.mockResolvedValue({ Item: marshall(smallSample) });

      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);
      const result = await zordom.find({ id }, ["completed"]);

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).toHaveBeenCalledTimes(1);
      expect(GetItemCommand).toHaveBeenCalledWith(getCommand(id, ["completed"].join(',')))
      expect(result).toStrictEqual(smallSample);
    });

    it('should handle query without range attribute with range', async () => {
      dynamo.send.mockResolvedValue({ Item: marshall(noteSample) });

      const id = 'sampleId';
      const owner = 'guidi';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, configWithRange);
      const result = await zordom.find({ aa: "1", id , owner });

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).toHaveBeenCalledTimes(1);
      expect(GetItemCommand).toHaveBeenCalledWith(getCommand(id))
      expect(result).toStrictEqual(noteSample);
    });

    it('should throw an error about not found', async () => {
      dynamo.send.mockResolvedValue({ Item: undefined });

      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      await expect(zordom.find({ id })).rejects.toThrow(
        new NotFoundItem(tableName, marshall({ id }))
      );

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).toHaveBeenCalledTimes(1);
      expect(GetItemCommand).toHaveBeenCalledWith(getCommand(id))
    });

    it('should throw an error about invalid hash', async () => {
      const potato = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      await expect(zordom.find({ potato })).rejects.toThrow(
        new InvalidKey(tableName, config.hash, { potato })
      );

      expect(dynamo.send).not.toHaveBeenCalledTimes(1);
      expect(dynamo.send).not.toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).not.toHaveBeenCalledTimes(1);
      expect(GetItemCommand).not.toHaveBeenCalledWith(getCommand(potato))
    });

    it('should throw an error about invalid range', async () => {
      const id = 'sampleId';
      const potato = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, configWithRange);

      await expect(zordom.find({ id, potato })).rejects.toThrow(
        new InvalidKey(tableName, configWithRange.range, { id, potato })
      );

      expect(dynamo.send).not.toHaveBeenCalledTimes(1);
      expect(dynamo.send).not.toHaveBeenCalledWith(fakeCmd('get'))
      expect(GetItemCommand).not.toHaveBeenCalledTimes(1);
      expect(GetItemCommand).not.toHaveBeenCalledWith(getCommand(potato))
    });
  });

  describe("save method", () => {
    beforeEach(() => {
      (PutItemCommand as unknown as jest.Mock).mockImplementation(() => fakeCmd('put'));
    })

    it('should execute sa e method without errors', async () => {
      dynamo.send.mockResolvedValue({});

      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);
      const result = await zordom.save(noteSample);

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('put'))
      expect(PutItemCommand).toHaveBeenCalledTimes(1);
      expect(PutItemCommand).toHaveBeenCalledWith(putCommand(noteSample))
      expect(result).toStrictEqual(noteSample);
    })
  });

  describe("update method", () => {
    beforeEach(() => {
      (UpdateItemCommand as unknown as jest.Mock).mockImplementation(() => fakeCmd('update'));
    });

    it('should execute the update method without errors', async () => {
      const id = "sampleId";
      const newOwner = "digui";
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      dynamo.send.mockResolvedValue({ Attributes: marshall({ ...noteSample, owner: newOwner }) });
      const result = await zordom.update({ id }, { owner: newOwner });

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('update'));
      expect(UpdateItemCommand).toHaveBeenCalledTimes(1);
      expect(UpdateItemCommand).toHaveBeenCalledWith(
        updateCommand(
          { id },
          { "#owner": 'owner' },
          { ":owner":  { S: newOwner } },
          "SET #owner = :owner"
        )
      );

      expect(result).toStrictEqual({ ...noteSample, owner: newOwner });
    });

    it('should throw an error for an invalid hash during update', async () => {
      const potato = "invalidId";
      const newOwner = "digui";
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      await expect(zordom.update({ potato }, { owner: newOwner })).rejects.toThrow(
        new InvalidKey(tableName, config.hash, { potato })
      );

      expect(dynamo.send).not.toHaveBeenCalledTimes(1);
      expect(dynamo.send).not.toHaveBeenCalledWith(fakeCmd('update'));
      expect(UpdateItemCommand).not.toHaveBeenCalledTimes(1);
      // ... assertions for UpdateItemCommand not being called with invalid parameters
    });

    it('should throw an error when update does not return the updated item', async () => {
      const id = "sampleId";
      const newOwner = "digui";
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      dynamo.send.mockResolvedValue({}); // Simulate update not returning updated item

      await expect(zordom.update({ id }, { owner: newOwner })).rejects.toThrow(
        new Error("Update did not return the updated item.")
      );

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('update'));
      expect(UpdateItemCommand).toHaveBeenCalledTimes(1);
      // @TODO: assertions for UpdateItemCommand being called with the correct parameters
    });
  });


  describe("remove method", () => {
    beforeEach(() => {
      (DeleteItemCommand as unknown as jest.Mock).mockImplementation(() => fakeCmd('delete'));
    });

    it('should execute the remove method without errors', async () => {
      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      await zordom.remove({ id });

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(fakeCmd('delete'));
      expect(DeleteItemCommand).toHaveBeenCalledTimes(1);
      expect(DeleteItemCommand).toHaveBeenCalledWith({
        Key: marshall({ [hash]: id }),
        TableName: tableName,
      });
    });

    it('should throw an error for an invalid hash during removal', async () => {
      const potato = 'invalidId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      await expect(zordom.remove({ potato })).rejects.toThrow(
        new Error("Invalid key in query.")
      );

      expect(dynamo.send).not.toHaveBeenCalledTimes(1);
      expect(dynamo.send).not.toHaveBeenCalledWith(fakeCmd('delete'));
      expect(DeleteItemCommand).not.toHaveBeenCalledTimes(1);
      expect(DeleteItemCommand).not.toHaveBeenCalledWith({
        Key: marshall({ [hash]: potato }),
        TableName: tableName,
      });
    });
  });

});
