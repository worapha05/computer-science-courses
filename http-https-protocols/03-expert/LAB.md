# Lab — Level 3 Expert (Protocol Evolution, Profiling, Production Tuning)

ใช้เครื่องมือใน `src/` กับบริการที่คุณมีสิทธิ์เท่านั้น (localhost หรือ lab ของคุณ)

---

## Lab 3.1 — มองเห็น HTTP/1.1 HOL vs HTTP/2 Multiplexing

### สถานการณ์

หน้าเว็บโหลดช้าทั้งที่ bandwidth ยังเหลือ — waterfall ใน DevTools แสดง request รอคิวนานบน HTTP/1.1

### งานที่ต้องทำ

```bash
cd 03-expert/src
node h2-multiplex-demo.js
```

สังเกตว่า client ส่งหลาย stream พร้อมกันบน connection เดียว และเวลาจบรวมใกล้เคียงกับ request ที่ช้าที่สุด ไม่ใช่ผลรวมแบบ serial

เปรียบเทียบด้วย curl (h2c):

```bash
curl -s --http2-prior-knowledge http://127.0.0.1:8442/slow/x
curl -s --http2-prior-knowledge http://127.0.0.1:8442/fast/y
```

ตอบคำถาม:

1. HOL blocking ของ HTTP/1.1 ต่างจาก TCP HOL ของ HTTP/2 อย่างไร?
2. Domain sharding ช่วยเมื่อไหร่ และทำไมถึงแย่บน HTTP/2?
3. HPACK ช่วยลดอะไร?

### เฉลย — วิธีคิด

1. **HTTP/1.1 HOL:** request/response ถูก serialize บน connection (หรือถูกจำกัดจำนวน connection) ทำให้ resource หลังต้องรอ
   **TCP HOL (กระทบ HTTP/2):** packet หายทำให้ TCP หยุดส่งทุก stream บน connection นั้นจนกว่าจะ retransmit — แม้ชั้น HTTP จะ multiplex แล้ว
2. Sharding เพิ่ม parallel TCP บน HTTP/1.1 เพื่อเลี่ยงลิมิต ~6 connections — บน HTTP/2 คุณต้องการ **น้อย connection** เพื่อใช้ multiplexing และลด TLS handshake
3. HPACK บีบอัด headers ซ้ำๆ (cookie, user-agent) ลด bytes และ CPU บน request จำนวนมาก

### โครงสร้างโน้ตที่แนะนำ

```
03-expert/labs/lab3-1/
 notes.md
 screenshot-or-timing.txt
```

---

## Lab 3.2 — Profile Timing ด้วย cURL แยกชั้นปัญหา

### สถานการณ์

ผู้ใช้บ่นว่า "เว็บช้า" — คุณต้องแยกว่าช้าที่ DNS, TLS, แอป, หรือ download

### งานที่ต้องทำ

```bash
cd 03-expert/src/scripts
chmod +x profile-url.sh compare-http-versions.sh
./profile-url.sh https://example.com/
# หรือ lab HTTPS ของคุณ:
./profile-url.sh https://127.0.0.1:8443/
```

ถ้าเป้าหมายรองรับทั้ง 1.1 และ 2:

```bash
ROUNDS=5 ./compare-http-versions.sh https://example.com/
```

เติมตาราง:

| ชั้น | ตัวชี้วัด cURL                    | ค่าที่วัดได้ | สมมติฐาน |
| ---- | --------------------------------- | ------------ | -------- |
| DNS  | `time_namelookup`                 |              |          |
| TCP  | `time_connect - namelookup`       |              |          |
| TLS  | `time_appconnect - connect`       |              |          |
| TTFB | `time_starttransfer - appconnect` |              |          |
| Body | `time_total - starttransfer`      |              |          |

### เฉลย — แนวทางอ่านผล

- TLS สูงผิดปกติ → ตรวจ session resumption, cipher, ระยะทาง RTT, OCSP
- TTFB สูง → ดูแอป/DB/upstream ไม่ใช่แค่ "เพิ่ม CDN"
- Body สูง → ขนาด payload, ไม่มี compression, หรือ bandwidth
- `http_version=1.1` ทั้งที่ตั้ง h2 → ตรวจ ALPN, `http2 on`, client flag

---

## Lab 3.3 — วิเคราะห์ Traffic ด้วย tcpdump / Wireshark

### งานที่ต้องทำ

1. อ่าน `scripts/wireshark-hints.md`
2. จับ plain HTTP จาก Beginner server:

```bash
# terminal A
sudo tcpdump -i lo -s 0 -w /tmp/raw-http.pcap port 8080

# terminal B
node ../../01-beginner/src/raw-http-server.js
curl -v http://127.0.0.1:8080/headers
# หยุด tcpdump แล้วเปิดใน Wireshark → Follow TCP Stream
```

3. (ถ้าทำได้) ตั้ง `SSLKEYLOGFILE` แล้วจับ TLS จาก Intermediate HTTPS server — หา ClientHello + ALPN

### เฉลย — สิ่งที่ต้องชี้ใน capture ได้

- Request line + Host header ใน cleartext HTTP
- ใน TLS: ClientHello มี SNI และ ALPN; Application Data ไม่ใช่ข้อความอ่านได้จนกว่าจะ decrypt
- แยก TCP handshake (SYN) กับ TLS handshake กับ HTTP request

---

## Lab 3.4 — Production NGINX Config Review & Hardening

### สถานการณ์

คุณได้รับ `production-https.conf` ให้รีวิวก่อนขึ้น production

### งานที่ต้องทำ

เปิด `src/nginx/production-https.conf` แล้วตอบเป็น checklist:

- [ ] ใช้ `fullchain` + private key ถูกไฟล์หรือไม่?
- [ ] `ssl_protocols` ตัด 1.0/1.1 แล้วหรือยัง?
- [ ] มี session cache / tickets หรือไม่? ถ้าหลายโหนด จะแชร์ ticket key อย่างไร?
- [ ] OCSP stapling ครบ `ssl_stapling`, `ssl_trusted_certificate`, `resolver` หรือไม่?
- [ ] HTTP/2 เปิดอย่างไร? HTTP/3 ต้องมีอะไรเพิ่ม (quic listen + Alt-Svc + UDP firewall)?
- [ ] rate limit / timeouts กัน Slowloris และ flood ตรงไหน?
- [ ] security headers ใช้ `always` หรือไม่?

### เฉลยสรุป

| หัวข้อ     | จุดใน config                                    | เหตุผล                      |
| ---------- | ----------------------------------------------- | --------------------------- |
| Chain      | `ssl_certificate .../fullchain.pem`             | กัน incomplete chain        |
| Modern TLS | `TLSv1.2 TLSv1.3` + ECDHE GCM/ChaCha            | FS + AEAD                   |
| Resumption | `ssl_session_cache` / tickets                   | ลด handshake RTT            |
| OCSP       | stapling + resolver                             | ลด latency และ privacy leak |
| H2/H3      | `http2 on` + `listen ... quic` + `Alt-Svc`      | multiplexing / ลด TCP HOL   |
| Abuse      | `limit_req`, `limit_conn`, header/body timeouts | กัน flood / Slowloris       |
| Headers    | HSTS/CSP/XFO + `always`                         | ติดแม้ error responses      |

script ตรวจ build NGINX:

```bash
nginx -V 2>&1 | tr ' ' '\n' | grep -E 'http_v2|http_v3|quic|ssl'
```

---

## Lab 3.5 — Slowloris Lab แล้วใส่ Mitigation

### สถานการณ์

Origin ที่รับ TCP ตรงๆ อ่อนต่อ Slowloris — คุณต้องพิสูจน์อาการแล้วกันที่ edge

### งานที่ต้องทำ

```bash
# terminal 1 — victim (raw server มี concurrency จำกัดโดยธรรมชาติของ demo)
node ../../01-beginner/src/raw-http-server.js

# terminal 2 — lab attack (loopback only)
python3 attacks-demo/slowloris-lab.py --port 8080 --sockets 30 --interval 5

# terminal 3 — ผู้ใช้ปกติ
curl -m 3 -v http://127.0.0.1:8080/
```

สังเกตว่า request ปกติช้าลงหรือเชื่อมไม่ได้ แล้วออกแบบ mitigation:

1. ลด `client_header_timeout`
2. `limit_conn` ต่อ IP
3. วาง NGINX หน้าแอป

### เฉลย — วิธีคิด

Slowloris ไม่ได้ต้องการ bandwidth สูง แต่ต้องการ **ค้าง connection**
ดังนั้นการกันที่ดีคือ timeout สั้น + จำกัดจำนวน connection + ไม่ให้ client ถึง worker ของแอปโดยตรง

อย่าลืม: script ปฏิเสธ host ที่ไม่ใช่ loopback — ห้ามแก้เพื่อยิงระบบอื่น

---

## Lab 3.6 — HTTP/3 / QUIC Conceptual Drill

### งาน (แม้ยังไม่มี h3 ใน lab)

เขียนคำตอบสั้นๆ:

1. ทำไม HTTP/3 ใช้ UDP?
2. Connection migration ช่วยอะไรบนมือถือ?
3. ถ้า firewall บล็อก UDP 443 จะเกิดอะไร?
4. 0-RTT บน QUIC คล้ายความเสี่ยงอะไรของ TLS 1.3?

### เฉลย

1. QUIC สร้าง transport ใหม่ที่มี stream + loss recovery ของตัวเอง — หลบ TCP HOL และรวม TLS 1.3 ใน handshake
2. เปลี่ยน IP (Wi-Fi ↔ cellular) โดยไม่ต้องเริ่ม connection ใหม่ทั้งหมด เพราะใช้ **Connection ID**
3. Client ควร fallback ไป HTTP/2 หรือ HTTP/1.1 บน TCP 443 — UX ยังใช้ได้ถ้าตั้ง Alt-Svc/fallback ถูกต้อง
4. ความเสี่ยง **replay** ของ early data — ห้ามใช้กับ non-idempotent requests

---

## Capstone — รวมสามระดับ

ออกแบบและเอกสารสั้นๆ (1–2 หน้า) สำหรับ API `https://api.shop.lab`:

1. TLS 1.3 + fullchain + HSTS + session cookie flags
2. NGINX: h2 (และ h3 ถ้าได้), OCSP stapling, rate limit
3. Idempotency-Key สำหรับ `POST /payments`
4. แผนวัดผลด้วย `profile-url.sh` และ DevTools protocol column
5. แผนตอบสนอง Slowloris / HTTP flood

### โครงสร้างไฟล์ Capstone ที่แนะนำ

```
03-expert/labs/capstone/
 ARCHITECTURE.md
 nginx.conf   # ดัดจาก production-https.conf
 app-notes.md  # headers, cookies, idempotency
 runbook-ddos.md
```

---

## Checkpoint จบหลักสูตร

- [ ] อธิบาย H1 vs H2 vs H3 พร้อมข้อจำกัด HOL แต่ละชั้น
- [ ] ใช้ cURL แยก DNS/TCP/TLS/TTFB/Body ได้
- [ ] อ่าน ClientHello / ALPN ใน Wireshark (หรืออธิบายขั้นตอนได้)
- [ ] รีวิวและปรับ NGINX production TLS/H2/H3 + rate limit ได้
- [ ] รัน Slowloris lab บน localhost และเสนอ mitigation ได้

กลับไปภาพรวมหลักสูตรที่ [`../README.md`](../README.md)
