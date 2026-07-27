# Level 1 — Beginner: HTTP Paradigm & Raw Text Protocol Mechanics

> เป้าหมาย: เข้าใจว่าเว็บทำงานอย่างไรในระดับ Application Layer โดยมอง HTTP เป็นข้อความบน TCP ไม่ใช่แค่ "เรียก API"

---

## สารบัญ

1. [Client-Server Model & TCP/IP Mapping](#1-client-server-model--tcpip-mapping)
2. [Anatomy of Request & Response](#2-anatomy-of-request--response)
3. [Statelessness & State Retention](#3-statelessness--state-retention)
4. [HTTP Methods & Idempotency](#4-http-methods--idempotency)
5. [Best Practices](#5-best-practices)
6. [ไฟล์ตัวอย่างใน `src/`](#6-ไฟล์ตัวอย่างใน-src)

---

## 1. Client-Server Model & TCP/IP Mapping

### 1.1 โมเดล Client–Server ของเว็บ

```
Browser / curl / App  ──── HTTP Request ────▶  Web Server
       ◀─── HTTP Response ────
```

- **Client** เริ่มต้นการสื่อสารเสมอ (ยกเว้น Server-Sent Events / WebSocket หลัง handshake)
- **Server** รอฟังบน port (ปกติ 80 สำหรับ HTTP, 443 สำหรับ HTTPS)
- หนึ่ง "หน้าเว็บ" มักเกิดจากหลาย Request (HTML, CSS, JS, รูป, API)

### 1.2 Mapping กับ TCP/IP Stack

| OSI / ชั้น   | Protocol ที่เกี่ยวข้อง                                | บทบาทกับ HTTP                        |
| ------------ | ----------------------------------------------------- | ------------------------------------ |
| Application  | **HTTP**                                              | รูปแบบข้อความ Request/Response       |
| Presentation | (TLS อยู่ที่ Intermediate)                            | เข้ารหัส payload                     |
| Session      | Cookies / Application Session                         | รักษา state เหนือ HTTP ที่ stateless |
| Transport    | **TCP** (HTTP/1.x, HTTP/2) หรือ **UDP/QUIC** (HTTP/3) | ส่ง byte stream ที่เชื่อถือได้       |
| Network      | IP                                                    | Routing ระหว่าง host                 |
| Link         | Ethernet / Wi-Fi                                      | Frame บน media                       |

**ประเด็นสำคัญ:** HTTP เองไม่รู้เรื่อง packet — มันเห็นเป็น **byte stream** บน TCP connection
TCP แบ่ง stream เป็น segments, IP แบ่งเป็น packets — แต่เมื่ออ่านด้วย `socket.recv()` คุณจะได้ข้อความ HTTP แบบเต็มหรือบางส่วนก็ได้ จึงต้อง parse อย่างระมัดระวัง

### 1.3 การเปิด Connection (สรุป)

```
Client       Server
 |        |
 |---- TCP SYN ---------------->|
 |<--- TCP SYN-ACK -------------|
 |---- TCP ACK ---------------->| ← TCP handshake เสร็จ
 |        |
 |---- HTTP Request (bytes) --->|
 |<--- HTTP Response -----------|
 |---- (optional more reqs) --->| ← Keep-Alive / persistent connection
 |---- TCP FIN / RST ---------->|
```

ใน HTTP/1.0 เดิม: เปิด TCP ใหม่ทุก Request
ใน HTTP/1.1: ค่าเริ่มต้นเป็น **persistent connection** (`Connection: keep-alive`)

---

## 2. Anatomy of Request & Response

### 2.1 โครงสร้างข้อความ HTTP (Raw Text)

HTTP/1.x เป็น **ข้อความ ASCII/UTF-8** คั่นบรรทัดด้วย `CRLF` (`\r\n`)

**Request:**

```http
GET /api/users?page=1 HTTP/1.1\r\n
Host: example.com\r\n
User-Agent: curl/8.5.0\r\n
Accept: application/json\r\n
Connection: keep-alive\r\n
\r\n
```

**Response:**

```http
HTTP/1.1 200 OK\r\n
Content-Type: application/json\r\n
Content-Length: 27\r\n
Cache-Control: no-store\r\n
\r\n
{"users":[],"page":1}
```

โครงสร้างทั่วไป:

```
start-line CRLF
*( header-field CRLF )
CRLF
[ message-body ]
```

### 2.2 Start Line

| ฝั่ง     | รูปแบบ                                         | ตัวอย่าง                 |
| -------- | ---------------------------------------------- | ------------------------ |
| Request  | `METHOD SP request-target SP HTTP-version`     | `POST /login HTTP/1.1`   |
| Response | `HTTP-version SP status-code SP reason-phrase` | `HTTP/1.1 404 Not Found` |

**request-target** อาจเป็น:

- origin-form: `/path?query` (ใช้กับ proxy ปกติ + Host header)
- absolute-form: `http://example.com/path` (ใช้กับ proxy บางแบบ)
- asterisk-form: `*` (เช่น `OPTIONS *`)

### 2.3 Standard Headers ที่ต้องเข้าใจลึก

| Header             | ความหมาย                         | หมายเหตุ                                                     |
| ------------------ | -------------------------------- | ------------------------------------------------------------ |
| **Host**           | ชื่อ domain (+ port) ของเป้าหมาย | **บังคับใน HTTP/1.1** — ใช้ทำ Virtual Host                   |
| **Content-Type**   | MIME type ของ body               | เช่น `application/json`, `application/x-www-form-urlencoded` |
| **Content-Length** | ความยาว body เป็น byte           | ถ้าไม่มี อาจใช้ `Transfer-Encoding: chunked`                 |
| **User-Agent**     | ระบุ client                      | อย่าใช้เป็น security control อย่างเดียว                      |
| **Accept**         | client รับ media type อะไรได้    | Content Negotiation                                          |
| **Cache-Control**  | นโยบาย cache                     | `no-store`, `max-age=3600`, `private`                        |
| **Connection**     | `keep-alive` / `close`           | HTTP/1.1 default keep-alive                                  |
| **Cookie**         | ส่ง state กลับ server            | ดูหัวข้อ 3                                                   |
| **Set-Cookie**     | server ตั้ง cookie               | ดูหัวข้อ 3                                                   |

### 2.4 Body Formats

| Content-Type                        | ใช้เมื่อ              | ตัวอย่าง          |
| ----------------------------------- | --------------------- | ----------------- |
| `application/json`                  | API สมัยใหม่          | `{"name":"Ada"}`  |
| `application/x-www-form-urlencoded` | HTML form แบบดั้งเดิม | `name=Ada&age=30` |
| `multipart/form-data`               | upload ไฟล์           | boundary คั่นส่วน |
| `text/plain` / `text/html`          | ข้อความ / หน้าเว็บ    | —                 |
| `application/octet-stream`          | binary                | download ไฟล์     |

**Chunked Transfer Encoding:** เมื่อไม่รู้ขนาดล่วงหน้า

```http
Transfer-Encoding: chunked

5\r\n
Hello\r\n
6\r\n
 World\r\n
0\r\n
\r\n
```

### 2.5 HTTP Status Codes Taxonomy

| ช่วง    | หมวด          | ตัวอย่าง                                                                                         |
| ------- | ------------- | ------------------------------------------------------------------------------------------------ |
| **1xx** | Informational | `100 Continue`, `101 Switching Protocols`                                                        |
| **2xx** | Success       | `200 OK`, `201 Created`, `204 No Content`                                                        |
| **3xx** | Redirection   | `301 Moved Permanently`, `302 Found`, `304 Not Modified`                                         |
| **4xx** | Client Error  | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `429 Too Many Requests` |
| **5xx** | Server Error  | `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`                        |

**Best practice การเลือกโค้ด:**

- สร้าง resource สำเร็จ → `201` + `Location`
- รับแล้วแต่ไม่มี body → `204`
- validation ผิด → `400` หรือ `422`
- ไม่ login → `401`; login แล้วแต่ไม่มีสิทธิ์ → `403`

---

## 3. Statelessness & State Retention

### 3.1 HTTP เป็น Stateless

แต่ละ Request ถูกมองว่าเป็นอิสระ — server ไม่ "จำ" Request ก่อนหน้าในระดับโปรโตคอล
ดังนั้นจึงต้องมีกลไกรักษา state ที่ชั้น Application

### 3.2 Cookies

```http
Set-Cookie: session_id=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600
```

| Attribute             | หน้าที่                                                  |
| --------------------- | -------------------------------------------------------- |
| `HttpOnly`            | JS อ่าน cookie ไม่ได้ → ลด XSS steal session             |
| `Secure`              | ส่งเฉพาะบน HTTPS                                         |
| `SameSite`            | `Strict` / `Lax` / `None` — ควบคุม cross-site ส่ง cookie |
| `Max-Age` / `Expires` | อายุ cookie                                              |
| `Path` / `Domain`     | ขอบเขตการส่ง                                             |

Client ส่งกลับ:

```http
Cookie: session_id=abc123; theme=dark
```

### 3.3 Session Identifiers

รูปแบบทั่วไป:

1. Client login สำเร็จ
2. Server สร้าง **opaque session ID** เก็บใน store (memory / Redis / DB)
3. ส่ง ID ผ่าน `Set-Cookie`
4. Request ถัดไป server ดู cookie → โหลด session

อย่าเก็บข้อมูล sensitive ทั้งก้อนใน cookie โดยไม่เข้ารหัส/ลงนาม (ถ้าใช้ JWT ต้องเข้าใจ expiry, revocation, และ XSS risk)

### 3.4 Local Storage vs Session Storage (ฝั่ง Browser)

| Storage            | อายุ             | ส่งกับ HTTP อัตโนมัติ?   | ใช้เหมาะกับ                          |
| ------------------ | ---------------- | ------------------------ | ------------------------------------ |
| **Cookie**         | ตาม Max-Age      | **ใช่** (ถ้าไม่ถูกบล็อก) | Session ID, CSRF token คู่กับ header |
| **sessionStorage** | ปิดแท็บแล้วหาย   | ไม่                      | UI state ชั่วคราว                    |
| **localStorage**   | คงอยู่จนกว่าจะลบ | ไม่                      | Preference ที่ไม่ sensitive          |

**ความเข้าใจผิดที่พบบ่อย:** localStorage ไม่ใช่ "session ของ HTTP" — มันอยู่ที่ browser เท่านั้น และเสี่ยง XSS ถ้าเก็บ token

---

## 4. HTTP Methods & Idempotency

### 4.1 Methods หลัก

| Method      | ความหมายทั่วไป                              | Safe? | Idempotent? | มี Body? |
| ----------- | ------------------------------------------- | ----- | ----------- | -------- |
| **GET**     | อ่าน resource                               | ✅    | ✅          | ไม่แนะนำ |
| **HEAD**    | เหมือน GET แต่ไม่มี body                    | ✅    | ✅          | ไม่มี    |
| **OPTIONS** | ถาม capability / CORS preflight             | ✅    | ✅          | ได้      |
| **PUT**     | แทนที่ resource ทั้งก้อนด้วย representation | ❌    | ✅          | ใช่      |
| **DELETE**  | ลบ resource                                 | ❌    | ✅          | ได้      |
| **POST**    | ประมวลผล / สร้าง / action ที่ไม่เข้าพวกอื่น | ❌    | ❌*         | ใช่      |
| **PATCH**   | แก้บางส่วน                                  | ❌    | ❌*         | ใช่      |

\* ตามสเปก POST/PATCH ไม่รับประกัน idempotent — แต่คุณออกแบบให้เป็นได้ (เช่น Idempotency-Key)

### 4.2 Safe vs Unsafe

- **Safe:** ไม่ควรเปลี่ยน state บน server (GET, HEAD, OPTIONS)
- **Unsafe:** อาจเปลี่ยน state (POST, PUT, PATCH, DELETE)

ผลปฏิบัติ: crawler / prefetch ควรเรียกแค่ safe methods — ถ้าคุณใส่ "ลบข้อมูล" ไว้ที่ GET จะเกิดหายนะ

### 4.3 Idempotency เชิงปฏิบัติ

**Idempotent** = เรียกซ้ำ N ครั้ง ผลลัพธ์ state เท่ากับเรียก 1 ครั้ง

| สถานการณ์                               | Method                   | ทำไม                                           |
| --------------------------------------- | ------------------------ | ---------------------------------------------- |
| อ่านโปรไฟล์                             | GET `/users/1`           | อ่านอย่างเดียว                                 |
| update โปรไฟล์ทั้งก้อนด้วย JSON ชุดเดิม | PUT `/users/1`           | เขียนทับด้วยค่าเดียวกัน                        |
| สร้าง order ใหม่ทุกครั้งที่กด           | POST `/orders`           | แต่ละครั้งสร้าง resource ใหม่ → ไม่ idempotent |
| ชำระเงินซ้ำเมื่อ network timeout        | POST + `Idempotency-Key` | ทำให้ POST "ปลอดภัยต่อการ retry"               |

```http
POST /v1/payments HTTP/1.1
Host: api.shop.local
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{"amount":1000,"currency":"THB"}
```

Server เก็บผลของ key นั้น — ถ้า client retry ด้วย key เดิม จะได้ response เดิม ไม่คิดเงินซ้ำ

---

## 5. Best Practices

1. **บังคับมี `Host` ใน HTTP/1.1** และ validate ว่าตรงกับ virtual host ที่คาดหวัง
2. **อย่าใส่ side-effect ใน GET** — ใช้ POST/PUT/PATCH/DELETE
3. **ตั้ง `Content-Type` ให้ตรงกับ body จริง** และ reject type ที่ไม่รองรับ
4. **ใช้ `Cache-Control` อย่างจงใจ** — API ส่วนตัวมักต้องการ `no-store`
5. **Session cookie:** `HttpOnly` + `Secure` + `SameSite` เสมอเมื่อเป็นไปได้
6. **จำกัดขนาด body / header** เพื่อกัน memory exhaustion
7. **ปิด connection เมื่อ parse error** — อย่าพยายาม "เดา" request ที่ผิดรูป
8. **Log status code และ latency** แต่อย่า log cookie / Authorization แบบเต็ม

---

## 6. ไฟล์ตัวอย่างใน `src/`

| ไฟล์                            | คำอธิบาย                                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| `raw-http-server.js`            | HTTP server ด้วย Node.js `net` (ไม่ใช้ `http` module) — เห็น raw bytes |
| `raw-http-client.js`            | Client ส่ง raw HTTP บน TCP                                             |
| `http-parser-demo.py`           | แยก start-line / headers / body ด้วย Python                            |
| `methods-idempotency-server.go` | demo GET/POST/PUT + Idempotency-Key                                    |
| `cookie-session-server.js`      | demo cookie session แบบง่าย                                            |

รัน Lab ตาม [`LAB.md`](./LAB.md)
