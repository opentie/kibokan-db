'use strict';

const Store = require('./store');
const { Category } = require('kibokan');

class CategoryStore extends Store {
  constructor() {
    super();
    this.collectionName = 'categories';
    this.Serializable = Category;
  }

  createIndex() {
    this.collection.createIndex({ name: 1 }, { unique: true });
    this.collection.createIndex({ namespace: 1, name: 1 }, { unique: true });
  }

  getCounter(name) {
    return this.collection.findOneAndUpdate({ name }, {
      $inc: { autoincrement: 1 },
    }, { returnOriginal: false }).then(({ value }) => value.autoincrement);
  }
}

const categoryStore = new CategoryStore();

Category.resolve = (name) => {
  return categoryStore.findOne({ name });
};

module.exports = categoryStore;

