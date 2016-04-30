'use strict';

const assert = require('assert');
const { MongoClient, ObjectID } = require('mongodb');

class Store {
  constructor() {
    this.deserialize = this.deserialize.bind(this);
  }

  get db() {
    const db = this.constructor.db;
    assert(db !== null, 'missing connection to mongodb');
    return db;
  }

  get collection() {
    return this.db.collection(this.collectionName);
  }

  deserialize(doc) {
    return new this.Serializable().deserialize(doc);
  }

  _normalizeQuery(query) {
    for (const key of Object.keys(query)) {
      if (key === '_id') {
        query._id = ObjectID(query._id);
      }
    }

    return query;
  }

  find(query) {
    query = this._normalizeQuery(query);

    return this.collection.find(query).toArray().then(docs => {
      return docs.map(this.deserialize);
    });
  }

  findOne(query) {
    query = this._normalizeQuery(query);

    return this.collection.findOne(query).then(doc => {
      if (doc === null) {
        throw new Error(`not found ${this.Serializable.name}: ${JSON.stringify(query)}`);
      }

      return this.deserialize(doc);
    });
  }

  build(props = {}) {
    return Object.assign(new this.Serializable(), props);
  }

  update(instance) {
    assert(typeof instance.primaryKeyValue !== 'undefined');
    const serialized = instance.serialize({});

    const query = this._normalizeQuery({
      [instance.constructor.primaryKey]: instance.primaryKeyValue
    });

    return this.collection.updateOne(query, {
      $set: serialized
    }).then(() => {
      return this.findOne(query);
    });
  }

  insert(instance) {
    const serialized = instance.serialize({});

    return this.collection.insertOne(serialized).then(() => serialized);
  }

  save(instance) {
    const primaryKey = instance.primaryKeyValue;
    const isInsert = (typeof primaryKey === 'undefined');
    if (isInsert) {
      return this.insert(instance);
    }
    return this.update(instance);
  }

  createIndex() {
  }
}
Store.db = null;

const MONGODB_URL = process.env.MONGODB_URL ||
        'mongodb://localhost:27017/kibokan_test';

MongoClient.connect(MONGODB_URL).then((db) => {
  Store.db = db;
});

module.exports = Store;
