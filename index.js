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
    });

    this.body = category;
  },
  *create() {
    const params = this.params.only('_version', 'metadata', 'namespace', 'name', 'forms');

    const category = categoryStore.deserialize(params);
    this.body = yield categoryStore.insert(category);
  },
  *show() {
    this.body = this.category.serialize();
  },

  *category(name, next) {
    const { namespace } = this.params.all();
    this.category = yield categoryStore.findOne(
      Object.assign({ name }, params));

    yield next;
  },

  Entities: {
    *index() {
      this.body = yield entityStore.find({
        category_name: this.category.name
      });
    },
    *new() {
      const entity = entityStore.build({
        metadata: {},
        category: this.category,
        document: {},
      }).serialize({
        category: {}
      });

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

      this.body = yield entityStore.save(entity);
    },
    *show() {
      this.body = this.entity.serialize();
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

      const entities = entityStore.find({
        category_name: this.category.name,
        _id: { $in: ids },
      });

      this.body = entities.map(entity => entity.serialize());
    },

    *entity(_id, next) {
      this.entity = yield entityStore.findOne({
        category_name: this.category.name,
        _id
      });
      this.entity.category = this.category;

      yield next;
    }
  }
};

function *ok() {
  this.body = "it's ok";
  categoryStore.createIndex();
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
  });
}

nsRouter.get('/', ok);
nsRouter.use('/namespaces/:namespace', ...(() => {
  const router = new Router();

  router.param('category', Categories.category);
  router.param('entity', Categories.Entities.entity);

  router.get('/categories/', Categories.index);
  router.post('/categories/', Categories.create);
  router.get('/categories/:category', Categories.show);

  router.get('/categories/:category/entities/', Categories.Entities.index);
  router.get('/categories/:category/entities/new', Categories.Entities.new);
  router.post('/categories/:category/entities/', Categories.Entities.create);
  router.post('/categories/:category/entities/bulk', Categories.Entities.bulk);
  router.get('/categories/:category_name/entities/:entity', Categories.Entities.show);
  router.put('/categories/:category_name/entities/:entity', Categories.Entities.update);

  return [router.routes(), router.allowedMethods()];
})());

qs(app);
app.use(logger());
app.use(bodyparser());
app.use(nsRouter.routes());
app.listen(8124);
