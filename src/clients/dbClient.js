// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
const errorCodes = require('../lib/errorCodes');

const db = new AWS.DynamoDB.DocumentClient();

const dbClient = {
  async get(id, sortKey) {
    return db
      .get({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { id, sortKey },
      })
      .promise()
      .then((response) => response.Item);
  },
  // startTime: 20210805144159
  // endTime: 20210805144159
  list(id, sortKeyPrefix, { startTime, endTime, query, filterString } = {}) {
    let KeyConditionExpression = 'id = :id';
    let ExpressionAttributeValues = {
      ':id': id,
    };

    if (sortKeyPrefix && startTime && endTime) {
      KeyConditionExpression =
        'id = :id and sortKey between :startTime and :endTime';
      ExpressionAttributeValues = {
        ':id': id,
        ':startTime': `${sortKeyPrefix}${startTime}`,
        ':endTime': `${sortKeyPrefix}${endTime}`,
      };
    } else if (sortKeyPrefix) {
      KeyConditionExpression =
        'id = :id and begins_with(sortKey, :sortKeyPrefix)';
      ExpressionAttributeValues = {
        ':id': id,
        ':sortKeyPrefix': sortKeyPrefix,
      };
    }

    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression,
      ExpressionAttributeValues,
      ScanIndexForward: false,
    };
    if (query && filterString) {
      const queryExpression = {};
      Object.keys(query).forEach((key) => {
        queryExpression[`:${key}`] = query[key];
      });
      const attributeNames = {};
      Object.keys(query).forEach((key) => {
        attributeNames[`#${key}`] = key;
      });

      params.ExpressionAttributeValues = {
        ...params.ExpressionAttributeValues,
        ...queryExpression,
      };
      params.ExpressionAttributeNames = attributeNames;
      params.FilterExpression = filterString;
    }

    return db
      .query(params)
      .promise()
      .then((response) => response.Items);
  },
  async create(item) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Item: item,
    };

    await db.put(params).promise();

    return item;
  },
  async update(id, sortKey, item) {
    const current = await dbClient.get(id, sortKey);
    if (!current) {
      throw new Error(errorCodes.NOT_FOUND);
    }
    const updatedItem = { ...current, ...item, updatedAt: Date.now() };

    return dbClient.create(updatedItem);
  },
  async delete(id, sortKey) {
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: { id, sortKey },
    };

    return db
      .delete(params)
      .promise()
      .then(() => ({ id, sortKey }));
  },
};

module.exports = dbClient;
