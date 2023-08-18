
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { z } from "zod";
import { marshall } from "@aws-sdk/util-dynamodb";

import { Zordom } from '../src/zordom'; // Adjust the path accordingly

import type { ZordomConfig } from '../src/zordom';
import { NotFoundItem } from "../src/errors";

jest.mock("@aws-sdk/client-dynamodb");

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

  const getCommand = (hashValue: string, projectionExpression?: string) => new GetItemCommand({
    Key: marshall({
      [hash]: hashValue,
    }),
    ProjectionExpression: projectionExpression,
    TableName: tableName,
  })

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('find method', () => {

    it('should retrieve an item from the database only with hash', async () => {
      dynamo.send.mockResolvedValue({ Item: marshall(noteSample) });
      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);
      const result = await zordom.find({ id });

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(getCommand(id))
      expect(result).toStrictEqual(noteSample);
    });

    it('should retrieve an item from the database only with hash and with project fields', async () => {
      const smallSample = { completed: false };
      dynamo.send.mockResolvedValue({ Item: marshall(smallSample) });

      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);
      const result = await zordom.find({ id }, ["completed"]);

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(getCommand(id, ["completed"].join(',')))
      expect(result).toStrictEqual(smallSample);
    });

    it('should throw an error if item is not found', async () => {
      dynamo.send.mockResolvedValue({ Item: undefined });
      const id = 'sampleId';
      const zordom = new Zordom(dynamo as unknown as DynamoDBClient, noteSchema, config);

      expect(dynamo.send).toHaveBeenCalledTimes(1);
      expect(dynamo.send).toHaveBeenCalledWith(getCommand(id))
      await expect(zordom.find({ id })).rejects.toThrowError(
        new NotFoundItem(tableName, marshall({ id }))
      );
    });

    // it('should handle query without range attribute with range', async () => {

    // });

    // Add more test cases for edge cases and error scenarios
  });

  // describe('save method', () => {
  //   it('should save an item to the database', async () => {
  //     mockSend.mockResolvedValue({});

  //     const sampleSchema = z.object({
  //       id: z.string(),
  //       name: z.string(),
  //     });

  //     const sampleConfig: ZordomConfig<'id', undefined> = {
  //       hash: 'id',
  //       tableName: 'SampleTable',
  //     };

  //     const zordom = new Zordom(new DynamoDBClient({}), sampleSchema, sampleConfig);

  //     const data = {
  //       id: 'newId',
  //       name: 'New Item',
  //     };

  //     const result = await zordom.save(data);

  //     expect(result).toEqual(data);
  //   });

  //   it('should throw an error for invalid data', async () => {
  //     const sampleSchema = z.object({
  //       id: z.string(),
  //       name: z.string(),
  //     });

  //     const sampleConfig: ZordomConfig<'id', undefined> = {
  //       hash: 'id',
  //       tableName: 'SampleTable',
  //     };

  //     const zordom = new Zordom(new DynamoDBClient({}), sampleSchema, sampleConfig);

  //     const invalidData = {
  //       id: 123, // Invalid data type for 'id'
  //       name: 'Invalid Item',
  //     };

  //     await expect(zordom.save(invalidData)).rejects.toThrow('Validation failed');
  //   });
  // });

});
