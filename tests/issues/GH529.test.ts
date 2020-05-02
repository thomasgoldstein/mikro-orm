import { Collection, Entity, ManyToOne, MikroORM, OneToMany, PrimaryKey, PrimaryKeyType, Property, ReflectMetadataProvider } from '../../lib';
import { PostgreSqlDriver } from '../../lib/drivers/PostgreSqlDriver';

@Entity()
export class Customer {

  @PrimaryKey()
  id!: number;

}

@Entity()
export class Order {

  @PrimaryKey()
  id!: number;

  @ManyToOne()
  customer: Customer;

  @OneToMany(() => OrderItem, item => item.order)
  items = new Collection<OrderItem>(this);

  @Property()
  paid = false;

  @Property()
  shipped = false;

  @Property()
  created: Date = new Date();

  constructor(customer: Customer) {
    this.customer = customer;
  }

}

@Entity()
export class Product {

  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property()
  currentPrice: number;

  constructor(name: string, currentPrice: number) {
    this.name = name;
    this.currentPrice = currentPrice;
  }

}

@Entity()
export class OrderItem {

  @ManyToOne({ primary: true })
  order: Order;

  @ManyToOne({ primary: true })
  product: Product;

  @Property()
  amount: number = 1;

  @Property()
  offeredPrice: number;

  [PrimaryKeyType]: [number, number]; // this is needed for proper type checks in `FilterQuery`

  constructor(order: Order, product: Product, amount = 1) {
    this.order = order;
    this.product = product;
    this.offeredPrice = product.currentPrice;
    this.amount = amount;
  }

}

describe('GH issue 529', () => {

  let orm: MikroORM<PostgreSqlDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [Customer, Order, OrderItem, Product],
      dbName: `mikro_orm_test_gh_529`,
      type: 'postgresql',
      metadataProvider: ReflectMetadataProvider,
      cache: { enabled: false },
    });
    await orm.getSchemaGenerator().ensureDatabase();
    await orm.getSchemaGenerator().dropSchema();
    await orm.getSchemaGenerator().createSchema();
  });

  afterAll(async () => {
    await orm.close(true);
  });

  test(`GH issue 529`, async () => {
    const order = new Order(new Customer());
    order.items.add(new OrderItem(order, new Product('a', 55)));
    order.items.add(new OrderItem(order, new Product('b', 66)));
    order.items.add(new OrderItem(order, new Product('c', 77)));
    await orm.em.persistAndFlush(order);
    orm.em.clear();

    const orders = await orm.em.find(Order, {}, ['items']);
    expect(orders).toHaveLength(1);
    expect(orders[0].items.getItems()).toHaveLength(3);
    orm.em.clear();

    const o = await orm.em.findOneOrFail(Order, order.id);
    await o.items.init();
    expect(o.items.getItems()).toHaveLength(3);
  });
});
