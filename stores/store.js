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

  deserialize(doc, isPartial) {
    return new this.Serializable().deserialize(doc, isPartial);
  }

  _normalizeQuery(query) {
    for (const key of Object.keys(query)) {
      if (typeof query[key] === 'string' && key === '_id') {
        console.log(query, key);
        query._id = ObjectID(query._id);
      }
    }

    return query;
  }

  find(query) {
    query = this._normalizeQuery(query);

    return this.collection.find(query).toArray().then(docs => {
      return docs.map(doc => this.deserialize(doc));
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

  static close() {
    if (this.db) {
      return this.db.close();
    }

    return Promise.resolve(null);
  }

  static connect() {
    return MongoClient.connect(MONGODB_URL).then((db) => {
      console.error('CONNECTED TO MONGODB');
      Store.db = db;
      return db;
    }).catch(err => {
      console.error(err);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.connect.bind(this).then(resolve, reject);
        }, 1000);
      });
    });
  }
}
Store.db = null;

const MONGODB_URL = process.env.MONGODB_URL ||
        'mongodb://localhost:27017/kibokan_test';

module.exports = Store;
