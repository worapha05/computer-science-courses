# Zero to Expert: HTTP & HTTPS Protocols Bootcamp

หลักสูตรเรียนรู้ด้วยตนเองแบบครบวงจรสำหรับวิศวกรเครือข่าย, Web Performance Engineer และ Security Practitioner
ครอบคลุมกลไก Application Layer, Secure Handshake, วิวัฒนาการโปรโตคอล และการปรับแต่งประสิทธิภาพระดับ Production

---

## โครงสร้างหลักสูตร

| ระดับ               | folder                                   | หัวข้อหลัก                                            | ระยะเวลาแนะนำ |
| ------------------- | ---------------------------------------- | ----------------------------------------------------- | ------------- |
| **1. Beginner**     | [`01-beginner/`](./01-beginner/)         | HTTP Paradigm & Raw Text Protocol Mechanics           | 5–7 วัน       |
| **2. Intermediate** | [`02-intermediate/`](./02-intermediate/) | HTTPS Cryptography & The Secure Handshake             | 7–10 วัน      |
| **3. Expert**       | [`03-expert/`](./03-expert/)             | Protocol Evolution & High-Performance Web Engineering | 10–14 วัน     |

แต่ละระดับประกอบด้วย:

1. **`README.md`** — ทฤษฎี, กลไกเครือข่าย, โครงสร้าง Packet/Header, ความปลอดภัย และ Best Practices (ภาษาไทย)
2. **`src/`** — โค้ดตัวอย่าง Low-level HTTP Server/Client, การวิเคราะห์ Raw HTTP, config TLS/NGINX
3. **`LAB.md`** — โจทย์สถานการณ์จริง พร้อมเฉลยวิธีคิด โครงสร้างไฟล์ และ script

---

## Prerequisites

- พื้นฐาน TCP/IP และ Linux command line
- Node.js ≥ 18 **หรือ** Python ≥ 3.10 **หรือ** Go ≥ 1.21 (อย่างน้อยหนึ่งอย่าง)
- `curl`, `openssl`, และ (แนะนำ) Wireshark / `tcpdump`
- สำหรับระดับ Expert: NGINX ที่รองรับ HTTP/2 และ HTTP/3 (QUIC)

---

## ลำดับการเรียนที่แนะนำ

```
01-beginner → ทำความเข้าใจ Raw HTTP บน TCP
  ↓
02-intermediate → เพิ่มชั้น TLS + Security Headers
  ↓
03-expert → HTTP/2·3, Profiling, Production Tuning
```

**อย่าข้าม Lab** — แต่ละ Lab ออกแบบให้ยืนยันความเข้าใจก่อนขึ้นระดับถัดไป

---

## Quick Start

```bash
cd http-https-protocols-bootcamp

# Beginner: Raw HTTP server
cd 01-beginner/src
node raw-http-server.js
# อีก terminal: curl -v http://127.0.0.1:8080/

# Intermediate: HTTPS + self-signed cert
cd ../../02-intermediate/src
./certs/generate-certs.sh
node https-server.js

# Expert: ดู nginx configs และ scripts
cd ../../03-expert/src/nginx
```

---

## Learning Outcomes

เมื่อจบหลักสูตร คุณจะสามารถ:

- [ ] Dissect Request/Response ระดับ byte และอธิบาย mapping กับ TCP/IP stack
- [ ] อธิบายความแตกต่าง Safe / Unsafe / Idempotent ของ HTTP methods
- [ ] วาด TLS 1.2 vs 1.3 handshake และอธิบาย Key Exchange
- [ ] ตั้งค่า HSTS, CSP, SameSite และแก้ Certificate errors ได้
- [ ] อธิบาย HOL blocking ของ HTTP/1.1 และวิธีที่ HTTP/2·3 แก้
- [ ] ปรับ NGINX สำหรับ TLS session resumption, ALPN, OCSP stapling, HTTP/2/3
- [ ] ใช้ Wireshark / cURL / DevTools วิเคราะห์ traffic จริง
