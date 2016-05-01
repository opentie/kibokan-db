'use strict';

const { ObjectID } = require('mongodb');

const Store = require('./store');

const { Entity } = require('kibokan');

class EntityStore extends Store {
  constructor() {
    super();
    this.collectionName = 'entities';
    this.Serializable = Entity;
  }

  createIndex() {
    this.collection.createIndex({ number: 1 }, { unique: true });
  }
}

const entityStore = new EntityStore();

Entity.resolve = (id) => {
  return entityStore.findOne({ id });
};

module.exports = entityStore;
