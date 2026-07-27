# Level 3 — Expert: Protocol Evolution & High-Performance Web Engineering

> เป้าหมาย: เข้าใจวิวัฒนาการ HTTP/1.1 → HTTP/2 → HTTP/3/QUIC, วิเคราะห์ traffic จริง และปรับ NGINX/TLS สำหรับ production พร้อมแนวทางกันโจมตีระดับ Application Layer

---

## สารบัญ

1. [Protocol Generations](#1-protocol-generations)
2. [Network Profiling & Debugging](#2-network-profiling--debugging)
3. [Production Infrastructure & Performance Tuning](#3-production-infrastructure--performance-tuning)
4. [Application-Layer Attack Mitigations](#4-application-layer-attack-mitigations)
5. [Best Practices](#5-best-practices)
6. [ไฟล์ตัวอย่างใน `src/`](#6-ไฟล์ตัวอย่างใน-src)

---

## 1. Protocol Generations

### 1.1 HTTP/1.1 — Bottlenecks

แม้ persistent connection และ pipelining จะช่วยได้บ้าง แต่ในทางปฏิบัติ:

#### Head-of-Line (HOL) Blocking ระดับแอป

- Browser จำกัดจำนวน TCP connections ต่อ origin (~6)
- ถ้า response แรกช้า ทรัพยากรคิวหลังจะรอ — **HOL blocking ที่ชั้น HTTP**
- Pipelining ใน 1.1 แทบไม่ถูกใช้เพราะปัญหา intermediary

#### Keep-Alive

```http
Connection: keep-alive
```

- ลด handshake TCP/TLS ซ้ำ แต่ยัง serialize requests บน connection เดียวได้ไม่ดีเท่า HTTP/2 multiplexing

#### Domain Sharding

- กระจาย asset ไป `img1.cdn.com`, `img2.cdn.com` เพื่อเลี่ยงลิมิต 6 connections
- แลกมาด้วย DNS + TLS handshake เพิ่ม และ **แย่ลง** เมื่อย้ายไป HTTP/2 (ซึ่งต้องการ connection รวม)

### 1.2 HTTP/2 — Binary Framing & Multiplexing

HTTP/2 ยังรันบน **TCP** (มักบังคับ TLS ใน browser ผ่าน ALPN `h2`)

```
HTTP/1.1 text messages
  ↓
HTTP/2 binary frames: HEADERS, DATA, SETTINGS, PUSH_PROMISE, WINDOW_UPDATE, ...
  ↓
Streams (stream ID) multiplexed on ONE TCP connection
```

| feature                   | ประโยชน์                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **Multiplexing**          | หลาย request/response พร้อมกันบน connection เดียว → ลด HOL ชั้น HTTP                 |
| **HPACK**                 | บีบอัด headers ด้วย static/dynamic table — ลด overhead cookie/UA ซ้ำ                 |
| **Server Push**           | server ผลัก asset ก่อน client ขอ — ปัจจุบันหลาย browser ปิด/ลดการใช้ เพราะ cache ยาก |
| **Stream prioritization** | สื่อสารความสำคัญของ resource (implementation ขึ้นกับ stack)                          |

**ข้อจำกัด:** ยังมี **TCP HOL blocking** — ถ้า packet หาย ทุก stream บน connection นั้นรอ retransmission

### 1.3 HTTP/3 & QUIC

```
HTTP/3 application mapping
  ↓
QUIC (streams, TLS 1.3 integrated, connection IDs)
  ↓
UDP
```

| หัวข้อ               | HTTP/2 over TCP                  | HTTP/3 over QUIC                          |
| -------------------- | -------------------------------- | ----------------------------------------- |
| Transport            | TCP                              | UDP + QUIC                                |
| TLS                  | แยกชั้น (มัก TLS 1.2/1.3)        | **TLS 1.3 ฝังใน QUIC**                    |
| HOL blocking         | packet loss บล็อกทั้ง connection | loss กระทบเฉพาะ stream ที่เกี่ยวข้อง      |
| Connection migration | ผูก IP:port                      | **Connection ID** ย้าย Wi-Fi→cellular ได้ |
| Handshake            | TCP + TLS                        | มักรวมเป็น 1-RTT (0-RTT ได้)              |
| Congestion control   | ของ TCP kernel                   | ของ QUIC user-space (ยืดหยุ่น update)     |

**ALPN:** `h2` สำหรับ HTTP/2, `h3` สำหรับ HTTP/3 (พร้อม Alt-Svc advertisement)

---

## 2. Network Profiling & Debugging

### 2.1 cURL เป็นกล้องจุลทรรศน์

```bash
# ดู version โปรโตคอลที่ negotiate ได้
curl -sI --http2 https://example.com/ -o /dev/null -w 'http=%{http_version}\n'

# timing breakdown
curl -sO /dev/null -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' https://example.com/

# บังคับ HTTP/1.1 เพื่อเปรียบเทียบ
curl --http1.1 -sI https://example.com/
```

### 2.2 Browser DevTools — Network Tab

ดูอย่างน้อย:

- **Protocol** column: `h2`, `h3`, `http/1.1`
- **Waterfall**: queueing, DNS, TCP, TLS, TTFB, download
- **Priority** และว่ามีการ unblock/render-blocking หรือไม่
- **Initiator** หาใครโหลด resource

### 2.3 Wireshark / tcpdump

| จุดสนใจ                    | Filter ตัวอย่าง                                 |
| -------------------------- | ----------------------------------------------- |
| TCP HTTP ชัดๆ (ไม่ใช่ TLS) | `tcp.port == 8080`                              |
| TLS ClientHello            | `tls.handshake.type == 1`                       |
| ALPN                       | ดู extension ใน ClientHello                     |
| QUIC / HTTP3               | `quic` (decrypt ยากกว่า — ต้องมี SSLKEYLOGFILE) |

```bash
# จับ traffic lab
sudo tcpdump -i lo -w /tmp/http-lab.pcap port 8080

# สำหรับ decrypt TLS ใน Wireshark (Chrome/Firefox/curl บาง build)
export SSLKEYLOGFILE=/tmp/sslkeys.log
```

### 2.4 สิ่งที่ต้องแยกให้ชัดเวลา debug

1. **DNS ช้า** vs **TCP connect ช้า** vs **TLS handshake ช้า** vs **TTFB ช้า (แอป/DB)** vs **download ช้า (bandwidth)**
2. **HOL ที่ HTTP/1.1** vs **TCP loss กระทบ h2** vs **UDP ถูก firewall บล็อก (h3 ล้มแล้ว fallback)**

---

## 3. Production Infrastructure & Performance Tuning

### 3.1 NGINX ในฐานะ TLS Terminators / Reverse Proxy

หน้าที่หลัก:

- Terminate TLS, negotiate ALPN (`http/1.1`, `h2`, `h3`)
- Reverse proxy ไป upstream (แอปอาจพูด HTTP/1.1 ภายในได้)
- cache, rate limit, header hardening, compression

### 3.2 TLS Session Resumption

- **Session IDs / Session Tickets** ลด full handshake เหลือ abbreviated
- ใน cluster หลายโหนด: ต้องแชร์ ticket keys หรือใช้ sticky — ไม่งั้น resumption พลาด
- TLS 1.3 ใช้ PSK-based resumption

```nginx
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets on; # จัดการ key rotation ให้ดี
```

### 3.3 ALPN Negotiation

- Client เสนอโปรโตคอลใน ClientHello
- Server เลือก `h2` / `http/1.1` / (กับ QUIC listener) `h3`
- ถ้า ALPN ผิดพลาด อาจได้แค่ HTTP/1.1 ทั้งที่ตั้งใจเปิด h2

### 3.4 OCSP Stapling

- Browser ต้องตรวจ revocation — ถ้าไปถาม CA เองจะช้าและเพิ่ม privacy leak
- **OCSP stapling:** server ดึง OCSP response แล้ว "เย็บ" ส่งระหว่าง handshake

```nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
```

### 3.5 เปิด HTTP/2 และ HTTP/3

```nginx
listen 443 ssl;
http2 on;     # syntax ขึ้นกับ version NGINX
listen 443 quic reuseport; # HTTP/3
add_header Alt-Svc 'h3=":443"; ma=86400' always;
```

ตรวจ build: `nginx -V 2>&1 | grep -E 'http_v2|http_v3|quic'`

### 3.6 Upstream และ Buffering

- `proxy_http_version 1.1;` + keepalive ไป upstream ลด connection churn
- ปรับ `proxy_buffers` / `proxy_busy_buffers_size` ตามขนาด response
- เปิด `gzip` / `brotli` อย่างจงใจ — อย่าบีบไฟล์ที่บีบแล้ว (JPEG, mp4)

---

## 4. Application-Layer Attack Mitigations

> script ใน `attacks-demo/` มีไว้ให้รันใส่ **lab server ของคุณเองเท่านั้น**

### 4.1 Slowloris

- เปิด TCP หลายเส้น แล้วค่อยๆ ส่ง HTTP headers ไม่จบ → หมด worker ของ server
- กัน: limit connections ต่อ IP, idle timeout สั้น, reverse proxy ที่จัดการ connection เก่ง (NGINX), `client_header_timeout`, `client_body_timeout`

### 4.2 HTTP Flood / Application DDoS

- ยิง GET/POST จำนวนมากให้แอป/DB อ่อนแรง
- กัน: rate limiting, WAF, CAPTCHA/bot management, caching ที่ edge, autoscaling + circuit breaker, แยก static/dynamic

```nginx
limit_req_zone $binary_remote_addr zone=perip:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;

location / {
 limit_req zone=perip burst=20 nodelay;
 limit_conn addr 20;
}
```

### 4.3 MitM Interception Mitigation

- ใช้ HTTPS ถูกต้อง + HSTS + certificate pinning ในกรณี mobile ที่ออกแบบพิเศษ (ระวัง operational cost)
- ห้ามปิด certificate verification ใน production client
- Certificate Transparency / CAA DNS records
- ระวัง corporate TLS middlebox — ต้องติดตั้ง root ขององค์กรอย่างจงใจ ไม่ใช่ข้าม verify

---

## 5. Best Practices

1. วัดก่อนปรับ — แยก DNS/Connect/TLS/TTFB/Download
2. HTTP/2 เป็นค่าเริ่มต้นบน TLS; เปิด HTTP/3 เมื่ออัป stack และ firewall พร้อม UDP 443
3. **เลิก domain sharding** เมื่อย้ายมา h2/h3
4. ใช้ session resumption + OCSP stapling + TLS 1.3
5. Rate limit + timeout ที่ edge ก่อนถึงแอป
6. Monitor: handshake failure rate, HTTP version mix, 5xx, P95 latency
7. อย่าเปิด Server Push โดยไม่วัดผล
8. ทดสอบ failover: ถ้า UDP ถูกบล็อก ต้อง fallback ไป h2 ได้ราบรื่น

---

## 6. ไฟล์ตัวอย่างใน `src/`

| ไฟล์                               | คำอธิบาย                                    |
| ---------------------------------- | ------------------------------------------- |
| `nginx/production-https.conf`      | TLS + H2 + H3 + OCSP + rate limit + headers |
| `scripts/profile-url.sh`           | วัด timing / protocol ด้วย cURL             |
| `scripts/compare-http-versions.sh` | เปรียบเทียบ HTTP/1.1 vs 2                   |
| `scripts/wireshark-hints.md`       | ไกด์จับแพ็กเก็ตและ decrypt                  |
| `h2-multiplex-demo.js`             | demo request พาราเลลบน Node HTTP/2          |
| `attacks-demo/slowloris-lab.py`    | จำลอง Slowloris ใส่ lab server              |
| `attacks-demo/README.md`           | ข้อควรระวังด้าน ethics / ขอบเขต lab         |

ทำแบบฝึกใน [`LAB.md`](./LAB.md)
