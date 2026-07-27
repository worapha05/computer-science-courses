# Lab — Level 1 Beginner (HTTP Raw Text & Protocol Mechanics)

โจทย์ทั้งหมดรันบนเครื่องคุณเอง ใช้โค้ดใน `src/` เป็นฐาน
เขียนคำตอบสั้นๆ ในโน้ตส่วนตัวก่อนเปิดเฉลยแต่ละข้อ

---

## Lab 1.1 — จับและถอดโครงสร้าง Raw HTTP Request

### สถานการณ์

ทีม QA รายงานว่า API ตอบ `400 Bad Request` เมื่อยิงจาก script ภายใน แต่ `curl` ใช้ได้
คุณต้องพิสูจน์ว่า request ที่ส่งไป "เป็น HTTP ที่ถูกเกณฑ์หรือไม่"

### งานที่ต้องทำ

1. รัน raw server:

```bash
cd 01-beginner/src
node raw-http-server.js
```

2. ยิงด้วย client และด้วย `curl -v`:

```bash
node raw-http-client.js GET /headers
curl -v http://127.0.0.1:8080/headers
```

3. สร้างไฟล์ `my-request.http` ที่มี request **ขาด `Host`** แล้วส่งด้วย `nc` หรือแก้ไข client
4. ใช้ `python3 http-parser-demo.py` วิเคราะห์ sample และไฟล์ของคุณ
5. ตอบคำถาม:

- Start-line ประกอบด้วยอะไรบ้าง?
- ทำไม HTTP/1.1 ถึงบังคับ `Host`?
- `Content-Length` นับเป็น byte หรือตัวอักษร?

### โครงสร้างไฟล์ที่คาดหวัง (คำตอบของคุณ)

```
01-beginner/
 labs/
 lab1-1/
  my-request.http   # request ที่คุณแต่ง
  notes.md     # คำตอบคำถาม
  capture.txt    # แปะ raw response จาก server
```

### เฉลย — วิธีคิด

1. **HTTP/1.1 บังคับ Host** เพราะหนึ่ง IP อาจมีหลาย domain (Virtual Host) — ไม่มี Host server ไม่รู้ว่าจะ route ไป site ไหน
   Server ใน `raw-http-server.js` จึงตอบ `400` เมื่อไม่มี Host
2. Start-line ของ request = `METHOD` + `request-target` + `HTTP-version` คั่นด้วยช่องว่าง ลงท้าย `\r\n`
3. **Content-Length = จำนวน byte ของ body** ไม่ใช่จำนวนตัวอักษร Unicode (อักขระไทย 1 ตัวอาจหลาย byte ใน UTF-8)
4. Header จบด้วยบรรทัดว่าง `\r\n\r\n` — ถ้าขาด จะ parse ไม่จบ

### script ช่วย (ส่ง request ขาด Host ด้วย netcat)

```bash
# terminal 1
node raw-http-server.js

# terminal 2
printf 'GET /headers HTTP/1.1\r\nUser-Agent: broken\r\n\r\n' | nc 127.0.0.1 8080
```

คาดหวัง: `400 Bad Request` / `Missing Host header`

---

## Lab 1.2 — จำแนก Status Code และ Cache-Control จากสถานการณ์จริง

### สถานการณ์

ระบบสมาชิกมีอาการดังนี้:

| เคส | พฤติกรรมที่ผู้ใช้เห็น                   | สิ่งที่คุณต้องเลือก        |
| --- | --------------------------------------- | -------------------------- |
| A   | สมัครสำเร็จ สร้าง user ใหม่             | status + header ที่เหมาะสม |
| B   | ขอ resource ที่ลบไปแล้ว                 | status                     |
| C   | API ข้อมูลบัญชีส่วนตัวถูก CDN cache ผิด | Cache-Control ที่ถูก       |
| D   | client ส่ง JSON ผิดรูป                  | status                     |

### งานที่ต้องทำ

1. Map เคส A–D → status code (+ header ถ้ามี)
2. ใช้ raw server จำลองเคส D ด้วย `POST /echo` และเคส status ด้วย `GET /status/404`
3. อธิบายความต่าง `401` กับ `403`

### เฉลย

| เคส | คำตอบที่ถูกต้อง                                      | เหตุผล                          |
| --- | ---------------------------------------------------- | ------------------------------- |
| A   | `201 Created` + `Location: /users/{id}`              | สร้าง resource ใหม่สำเร็จ       |
| B   | `404 Not Found` (หรือ `410 Gone` ถ้ารู้ว่าลบถาวร)    | ไม่มี resource                  |
| C   | `Cache-Control: no-store` (หรือ `private, no-cache`) | ข้อมูลส่วนตัวห้าม cache สาธารณะ |
| D   | `400 Bad Request`                                    | client ส่งข้อความผิดรูป         |

- **401 Unauthorized** = ยังไม่พิสูจน์ตัวตน (ขาด/ผิด credentials)
- **403 Forbidden** = พิสูจน์ตัวตนแล้ว แต่ไม่มีสิทธิ์

---

## Lab 1.3 — Cookie Session กับ Statelessness

### สถานการณ์

Product manager ถามว่า "ทำไมต้อง login ใหม่ทุกครั้งถ้าเราไม่ใช้ cookie?" และ "เก็บ JWT ใน localStorage ดีไหม?"

### งานที่ต้องทำ

```bash
node cookie-session-server.js

# login แล้วบันทึก cookie
curl -c /tmp/cj -b /tmp/cj -s -X POST \
  -H 'Content-Type: application/json' \
  -d '{"user":"ada"}' http://127.0.0.1:8081/login

# เรียก /me โดยมี cookie และไม่มี cookie
curl -c /tmp/cj -b /tmp/cj -s http://127.0.0.1:8081/me
curl -s http://127.0.0.1:8081/me
```

ตอบ:

1. HTTP stateless หมายความว่าอย่างไรในบริบทนี้?
2. `HttpOnly` ป้องกันอะไร? ไม่ป้องกันอะไร?
3. ทำไมการเก็บ access token ใน `localStorage` จึงเสี่ยง XSS?

### เฉลย — วิธีคิด

1. Server ไม่ได้จำ TCP connection ว่า "คนนี้คือ ada" — ทุก request ต้องพกหลักฐาน (cookie `session_id`) ไปเอง
2. `HttpOnly` ทำให้ `document.cookie` อ่านค่าไม่ได้ → ลดการขโมย session ผ่าน XSS **แต่** ไม่กัน CSRF และไม่กัน malware ระดับ OS
3. `localStorage` เข้าถึงได้จาก JS ทุก script บน origin เดียวกัน — ถ้ามี XSS ผู้โจมตีอ่าน token แล้วเรียก API แทนผู้ใช้ได้

### script ทดสอบอัตโนมัติสั้นๆ

```bash
#!/usr/bin/env bash
# labs/lab1-3/verify-session.sh
set -euo pipefail
CJ=$(mktemp)
trap 'rm -f "$CJ"' EXIT

curl -sf -c "$CJ" -b "$CJ" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"user":"lab"}' http://127.0.0.1:8081/login | grep -q '"ok": true'

curl -sf -c "$CJ" -b "$CJ" http://127.0.0.1:8081/me | grep -q '"user": "lab"'

code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/me)
test "$code" = "401"
echo "lab1-3 OK"
```

---

## Lab 1.4 — Idempotency: PUT vs POST และการชำระเงินซ้ำ

### สถานการณ์

แอปมือถือ timeout ตอนกด "สร้างออเดอร์" ผู้ใช้กดซ้ำ 3 ครั้ง เกิดออเดอร์ซ้ำในระบบจริง

### งานที่ต้องทำ

```bash
go run methods-idempotency-server.go
```

ทดลอง:

```bash
# POST ซ้ำโดยไม่มี key → ได้ id ต่างกัน
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"name":"order"}' http://127.0.0.1:8090/items
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"name":"order"}' http://127.0.0.1:8090/items

# POST ซ้ำด้วย Idempotency-Key เดิม → ได้ผลเดิม + header Idempotent-Replay
curl -sD - -X POST \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-001' \
  -d '{"name":"paid"}' http://127.0.0.1:8090/items

curl -sD - -X POST \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payment-001' \
  -d '{"name":"paid"}' http://127.0.0.1:8090/items

# PUT ซ้ำด้วย body เดิม → state เท่าเดิม
curl -s -X PUT -H 'Content-Type: application/json' \
  -d '{"name":"Ada"}' http://127.0.0.1:8090/items/1
```

ตอบ:

1. ทำไม GET/PUT ถึงถือว่า idempotent แต่ POST โดยทั่วไปไม่?
2. Idempotency-Key ควร generate จากใคร (client หรือ server)?
3. ถ้า body เปลี่ยนแต่ key เดิม ควรทำอย่างไร? (ออกแบบ)

### เฉลย

1. GET ไม่เปลี่ยน state; PUT กำหนด representation ทั้งก้อน — ทำซ้ำได้ผลเดียวกัน
   POST มักหมายถึง "สร้าง/กระทำ" ที่สร้าง side-effect ใหม่ทุกครั้ง
2. **Client** ต้องสร้าง key ก่อนส่ง (UUID) และ reuse เมื่อ retry — ถ้า server สร้าง จะช่วยตอน retry ไม่ได้
3. ทางที่ดี: ผูก key กับ hash(body) — ถ้า key เดิมแต่ body ต่าง → ตอบ `409 Conflict`
   (โค้ดตัวอย่างใช้ `key|body` เป็น fingerprint ซึ่งให้ผลคล้ายกัน: body ต่าง = บันทึกคนละรายการ)

### โครงสร้างไฟล์เฉลยอ้างอิง

```
01-beginner/
 src/
 raw-http-server.js
 raw-http-client.js
 http-parser-demo.py
 cookie-session-server.js
 methods-idempotency-server.go
 LAB.md
 README.md
 labs/     # สร้างเองตอนทำแบบฝึก
 lab1-1/
 lab1-3/verify-session.sh
```

---

## Checkpoint ก่อนขึ้น Intermediate

- [ ] อธิบาย TCP handshake กับ HTTP request ต่างกันอย่างไร
- [ ] วาดโครงสร้าง Request ที่มี start-line, headers, body
- [ ] ตั้ง cookie session และอ่าน `/me` ได้
- [ ] อธิบาย idempotency และใช้ Idempotency-Key กันยิงซ้ำได้

เมื่อครบแล้วไปที่ [`../02-intermediate/`](../02-intermediate/)
