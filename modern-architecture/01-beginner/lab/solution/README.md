# ShopLite — Beginner Lab Solution

```bash
node 01-beginner/lab/solution/server.js
```

ทดสอบ:

```bash
curl -s http://localhost:3200/products | jq
curl -s "http://localhost:3200/products?category=gadgets" | jq
curl -s -X POST http://localhost:3200/orders \
  -H 'content-type: application/json' \
  -d '{"productId":"p2","qty":1}' | jq
```

อ่าน [`NOTES.md`](./NOTES.md) สำหรับเฉลยคำถามคิด
