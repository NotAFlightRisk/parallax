/**
 * A three-way incident where the clocks disagree: the edge is right, the api runs
 * 3m56s fast and the database 2s slow. Read straight through, nothing causes anything.
 */
export const DEMO = [
  {
    name: 'edge',
    text: `10.0.0.4 - - [17/Aug/2026:02:13:58 +0000] "GET /api/orders?page=1 HTTP/1.1" 200 4821 "-" "checkout/2.4"
10.0.0.9 - - [17/Aug/2026:02:14:01 +0000] "POST /api/orders HTTP/1.1" 201 118 "-" "checkout/2.4"
10.0.0.4 - - [17/Aug/2026:02:14:03 +0000] "GET /api/orders/88213 HTTP/1.1" 200 611 "-" "checkout/2.4"
10.0.0.9 - - [17/Aug/2026:02:14:06 +0000] "POST /api/orders HTTP/1.1" 502 166 "-" "checkout/2.4"
10.0.0.4 - - [17/Aug/2026:02:14:07 +0000] "POST /api/orders HTTP/1.1" 502 166 "-" "checkout/2.4"
10.0.0.9 - - [17/Aug/2026:02:14:09 +0000] "POST /api/orders HTTP/1.1" 502 166 "-" "checkout/2.4"
10.0.0.4 - - [17/Aug/2026:02:14:14 +0000] "GET /healthz HTTP/1.1" 200 2 "-" "kube-probe/1.31"
10.0.0.9 - - [17/Aug/2026:02:14:21 +0000] "POST /api/orders HTTP/1.1" 201 118 "-" "checkout/2.4"
10.0.0.4 - - [17/Aug/2026:02:14:24 +0000] "GET /api/orders?page=1 HTTP/1.1" 200 4903 "-" "checkout/2.4"`
  },
  {
    name: 'api',
    text: `2026-08-17T02:17:57.140Z INFO  orders.create request=8f21ac account=4471
2026-08-17T02:17:57.212Z INFO  orders.create persisted id=88213 in 41ms
2026-08-17T02:17:59.318Z INFO  orders.read id=88213 cache=miss
2026-08-17T02:18:01.884Z WARN  pool acquire took 1912ms, 20 of 20 in use
2026-08-17T02:18:02.201Z ERROR orders.create failed request=b0c4de
Error: timeout acquiring connection from pool
    at Pool.acquire (/srv/api/node_modules/pg-pool/index.js:214:19)
    at OrderStore.insert (/srv/api/src/store/orders.ts:88:22)
    at async createOrder (/srv/api/src/routes/orders.ts:41:5)
2026-08-17T02:18:03.402Z ERROR orders.create failed request=c91f07 pool timeout
2026-08-17T02:18:05.640Z ERROR orders.create failed request=d3a880 pool timeout
2026-08-17T02:18:10.004Z INFO  pool reset, 20 connections recycled
2026-08-17T02:18:17.310Z INFO  orders.create persisted id=88214 in 38ms
2026-08-17T02:18:20.470Z INFO  orders.list page=1 rows=50 in 22ms`
  },
  {
    name: 'db',
    text: `Aug 17 02:13:57 db-01 postgres[812]: [4-1] LOG:  checkpoint starting: time
Aug 17 02:13:59 db-01 postgres[812]: [5-1] LOG:  duration: 41.220 ms  statement: INSERT INTO orders
Aug 17 02:14:02 db-01 postgres[904]: [6-1] LOG:  autovacuum: table "orders" has 2.1M dead rows
Aug 17 02:14:03 db-01 postgres[904]: [7-1] LOG:  autovacuum holding ShareUpdateExclusiveLock
Aug 17 02:14:04 db-01 postgres[812]: [8-1] LOG:  duration: 4102.881 ms  statement: INSERT INTO orders
Aug 17 02:14:06 db-01 postgres[812]: [9-1] FATAL:  sorry, too many clients already
Aug 17 02:14:08 db-01 postgres[812]: [10-1] FATAL:  sorry, too many clients already
Aug 17 02:14:14 db-01 postgres[904]: [11-1] LOG:  autovacuum: table "orders" done in 11.4s
Aug 17 02:14:17 db-01 postgres[812]: [12-1] LOG:  checkpoint complete: wrote 2841 buffers
Aug 17 02:14:21 db-01 postgres[812]: [13-1] LOG:  duration: 38.040 ms  statement: INSERT INTO orders`
  }
];
