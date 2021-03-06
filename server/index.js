require('dotenv/config');
const express = require('express');
const db = require('./database');
const ClientError = require('./client-error');
const staticMiddleware = require('./static-middleware');
const sessionMiddleware = require('./session-middleware');
// const { json } = require('express');
const app = express();

app.use(staticMiddleware);
app.use(sessionMiddleware);

app.use(express.json());

app.get('/api/health-check', (req, res, next) => {
  db.query('select \'successfully connected\' as "message"')
    .then(result => res.json(result.rows[0]))
    .catch(err => next(err));
});

app.get('/api/products', (req, res, next) => {
  const sql =
  `select
    "productId",
    "name",
    "price",
    "image",
    "shortDescription"
    from "products"`;
  db.query(sql)
    .then(result => {
      const product = result.rows;
      res.status(200);
      res.json(product);
    }).catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'An unexpected error occurred.'
      });
    });
});

app.get('/api/products/:productId', (req, res, next) => {
  const value = [req.params.productId];
  const sql =
    `select
    "productId",
    "name",
    "price",
    "image",
    "longDescription",
    "shortDescription"
    from "products"
    where "productId" = $1`;
  db.query(sql, value)
    .then(result => {
      const product = result.rows[0];
      res.json(product);
    }).catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'An unexpected error occurred.'
      });
    });
});

app.get('/api/carts', (req, res, next) => {
  const sql =
    `select *
    from "carts"`;

  db.query(sql)
    .then(result => {
      const cart = result.rows;
      res.json(cart);
    }).catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'An unexpected error occurred.'
      });
    });
});

app.get('/api/cartItems', (req, res, next) => {
  const sql =
    `select *
    from "cartItems"`;

  db.query(sql)
    .then(result => {
      const cartItems = result.rows;
      res.json(cartItems);
    }).catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'An unexpected error occurred.'
      });
    });
});

app.get('/api/cart', (req, res, next) => {
  if (!req.session.cartId) {
    res.json([]);
  } else {
    const sql =
        `select "c"."cartItemId",
        "c"."price",
        "p"."productId",
        "p"."image",
        "p"."name",
        "p"."shortDescription"
        from "cartItems" as "c"
        join "products" as "p" using ("productId")
        where "c"."cartId" = $1`;
    const value = [req.session.cartId];
    db.query(sql, value)
      .then(result => {
        res.json(result.rows);
      });
  }
});

app.post('/api/cart', (req, res, next) => {
  var proId = parseInt(req.body.productId);
  var values = [proId];
  if (!Number.isInteger(proId) || proId < 0) {
    res.status(400).json({
      error: 'invalid id'
    });
    return;
  }
  const sql =
  `select
  "price"
  from "products"
  where "productId" = $1`;

  db.query(sql, values)
    .then(result => {
      var rowPrice = result.rows;
      var arrayPrice = rowPrice.map(a => a.price);
      var indexPrice = arrayPrice[0];
      if (result.rows.length === 0) {
        throw new ClientError('oh no , an unexpected error occurred.', 404);
      }

      if (req.session.cartId) {

        const sql3 = `insert into "cartItems" ("cartId", "productId", "price")
          values ($1, $2, $3)
          returning "cartItemId"`;

        const values3 = [req.session.cartId, proId, indexPrice];
        return db.query(sql3, values3)
          .then(result3 => {

            const cartItemId = result3.rows[0].cartItemId;
            const sql4 =
              `select "c"."cartItemId",
                  "c"."price",
                  "p"."productId",
                  "p"."image",
                  "p"."name",
                  "p"."shortDescription"
              from "cartItems" as "c"
              join "products" as "p" using ("productId")
            where "c"."cartItemId" = $1`;
            const values4 = [cartItemId];

            return db.query(sql4, values4)
              .then(result4 => {
                res.status(201).json(
                  result4.rows[0]
                );
              });
          });

      } else {
        const sqlCart =
      ` insert into "carts" ("cartId", "createdAt")
          values (default, default)
          returning "cartId" `;

        return db.query(sqlCart)
          .then(result2 => {
            var arrayCartId = result2.rows[0].cartId;
            req.session.cartId = arrayCartId;

            const sql3 = `insert into "cartItems" ("cartId", "productId", "price")
              values ($1, $2, $3)
              returning "cartItemId"`;

            const values3 = [arrayCartId, proId, indexPrice];
            return db.query(sql3, values3)
              .then(result3 => {
                const cartItemId = result3.rows[0].cartItemId;
                const sql4 =
              `select "c"."cartItemId",
                  "c"."price",
                  "p"."productId",
                  "p"."image",
                  "p"."name",
                  "p"."shortDescription"
              from "cartItems" as "c"
              join "products" as "p" using ("productId")
            where "c"."cartItemId" = $1`;
                const values4 = [cartItemId];

                return db.query(sql4, values4)
                  .then(result4 => {
                    res.status(201).json(
                      result4.rows[0]
                    );
                  });
              });
          });
      }
    }).catch(error => {
      console.error(error);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.post('/api/orders', (req, res, next) => {
  if (!req.session.cartId) {
    throw new ClientError('No session with that "cartId" exists', 400);
  }
  if (!req.body.name || !req.body.creditCard || !req.body.shippingAddress) {
    throw new ClientError('"name", "creditCard", and "shippingAddress" must all be filled out', 400);
  } else if (!Number(req.body.creditCard) || req.body.creditCard.length !== 16) {
    throw new ClientError('creditCard must be a 16 digit number with no spaces', 400);
  }
  const sql = `
    insert into "orders" ("name", "creditCard", "shippingAddress", "cartId")
        values ($1, $2, $3, $4)
    returning "orderId",
              "createdAt",
              "name",
              "creditCard",
              "shippingAddress"
  `;
  const values = [req.body.name, req.body.creditCard, req.body.shippingAddress, req.session.cartId];
  db.query(sql, values)
    .then(order => {
      delete req.session.cartId;
      res.status(201).json(order.rows[0]);
    })
    .catch(err => console.error(err));
});

app.use('/api', (req, res, next) => {
  next(new ClientError(`cannot ${req.method} ${req.originalUrl}`, 404));
});

app.use((err, req, res, next) => {
  if (err instanceof ClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({
      error: 'an unexpected error occurred'
    });
  }
});

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port', process.env.PORT);
});
