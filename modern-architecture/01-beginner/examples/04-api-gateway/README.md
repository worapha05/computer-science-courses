# 04 — API Gateway (Local)

Express ทำหน้าที่เป็น **API Gateway จำลอง**: routing, CORS, ส่งต่อ query/headers เข้า Lambda handler

```bash
node 01-beginner/examples/04-api-gateway/server.js
```

จากนั้น:

```bash
curl -s "http://localhost:3100/hello?name=Ada" | jq
curl -s -X OPTIONS "http://localhost:3100/hello" -i | head
curl -s -H "X-Correlation-Id: lab-1" "http://localhost:3100/echo?q=1" | jq
```

ดูไฟล์ `openapi.snippet.yaml` สำหรับแนวคิดการ map route → function บน cloud
