# 02 — Gateway Routing & Access Logs

Local reverse proxy: route ตาม path prefix พร้อม centralized access log + correlation id

```bash
node 02-intermediate/examples/02-gateway-routing/gateway.js
```

```bash
curl -s http://localhost:3300/api/orders/ping | jq
curl -s http://localhost:3300/api/payments/ping | jq
curl -s http://localhost:3300/api/unknown/x | jq
```
