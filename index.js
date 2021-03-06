const assert = require('assert');

const koa = require('koa');
const logger = require('koa-logger');
const Router = require('koa-router');
const params = require('koa-strong-params');
const bodyparser = require('koa-bodyparser');
const qs = require('koa-qs');

const app = koa();
const nsRouter = new Router();

const { ObjectID } = require('mongodb');

const {
  Store,
  categoryStore,
  entityStore,
} = require('./stores');

const Categories = {
  *index() {
    const params = this.params.only('namespace');

    const categories = yield categoryStore.find(params);

    this.body = categories.map(category => category.serialize());
  },
  *new() {
    const { namespace } = this.params;
    const category = categoryStore.build({
      namespace,
      name: '',
      forms: [],
    }).serialize({}, true);

    this.body = category;
  },
  *create() {
    const params = this.params.only('_version', 'metadata', 'namespace', 'name', 'forms', 'autoincrement');

    const category = categoryStore.deserialize(params);
    this.body = yield categoryStore.insert(category);
  },
  *show() {
    this.body = this.category.serialize();
  },
  *update() {
    const params = this.params.only('_version', 'metadata', 'forms');
    this.category.deserialize(params, true);

    this.body = (yield categoryStore.update(this.category)).serialize();
  },

  *category(category_name, next) {
    const { namespace } = this.params.all();
    this.category = yield categoryStore.findOne({
      namespace,
      name: category_name,
    });

    yield next;
  },

  Entities: {
    *index() {
      const entities = yield entityStore.find({
        category_name: this.category.name
      });

      this.body = entities.map((entity) => entity.serialize());
    },
    *new() {
      const entity = entityStore.build({
        metadata: {},
        category: this.category,
        document: {},
      }).serialize({
        category: {}
      }, true);

      this.body = entity;
    },
    *create() {
      const params = this.params.only('_version', 'document');
      const entity = entityStore.deserialize(Object.assign({}, {
        metadata: {},
        category_name: this.category.name,
      }, params), true);
      entity.category = this.category;
      entity.normalize();
      entity.number = yield categoryStore.getCounter(this.category.name);

      this.body = yield entityStore.save(entity);
    },
    *show() {
      this.body = this.entity.serialize({ category: {} });
    },
    *update() {
      const params = this.params.only('_version', 'document');
      this.entity.deserialize(params, true);
      this.entity.normalize();

      this.body = yield entityStore.save(this.entity);
    },
    *bulk() {
      const params = this.params.only('ids');
      const ids = params.ids.map(ObjectID);

      const entities = yield entityStore.find({
        category_name: this.category.name,
        _id: { $in: ids },
      });

      const entitiesMap = new Map(entities.map(entity => {
        return [ entity._id.toString(), entity ];
      }));

      console.log(entitiesMap);

      this.body = ids.map(id => {
        const idStr = id.toString();
        if (!entitiesMap.has(idStr)) {
          return null;
        }

        return entitiesMap.get(idStr).serialize();
      });
    },

    *entity(entity_id, next) {
      const { category_name } = this.params.all();

      this.entity = yield entityStore.findOne({
        category_name,
        _id: entity_id,
      });
      this.entity.category = this.category;

      yield next;
    }
  }
};

function *ok() {
  this.body = "it's ok";
  categoryStore.createIndex();
  entityStore.createIndex();
}

nsRouter.use(function *(next) {
  this.query = Object.assign({}, this.query, this.params);
  yield next;
});
nsRouter.use(params());
if (process.env.NODE_ENV !== 'production') {
  nsRouter.use(function *(next) {
    console.log('PARAMETERS', this.params.all());
    yield next;
    console.log('RESPONCE', this.body);
  });
}

nsRouter.get('/', ok);
nsRouter.use('/namespaces/:namespace', ...(() => {
  const router = new Router();

  router.param('entity_id', Categories.Entities.entity);
  router.param('category_name', Categories.category);

  router.get('/categories/', Categories.index);
  router.post('/categories/', Categories.create);
  router.get('/categories/:category_name', Categories.show);
  router.put('/categories/:category_name', Categories.update);

  router.get('/categories/:category_name/entities/', Categories.Entities.index);
  router.get('/categories/:category_name/entities/new', Categories.Entities.new);
  router.post('/categories/:category_name/entities/', Categories.Entities.create);
  router.post('/categories/:category_name/entities/bulk', Categories.Entities.bulk);
  router.get('/categories/:category_name/entities/:entity_id', Categories.Entities.show);
  router.put('/categories/:category_name/entities/:entity_id', Categories.Entities.update);

  return [router.routes(), router.allowedMethods()];
})());

qs(app);
app.use(logger());
app.use(bodyparser());
app.use(nsRouter.routes());

Store.connect().then(() => {
  categoryStore.createIndex();
  entityStore.createIndex();
});
const server = app.listen(8124);

process.on('SIGTERM', () => {
  server.close(() => {
    Store.close();
  });
});
