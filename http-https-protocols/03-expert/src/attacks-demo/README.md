# Attacks Demo — Ethics & Scope

script ใน folder นี้มีจุดประสงค์ **เพื่อการศึกษาบน lab ของคุณเองเท่านั้น**

## อนุญาต

- รันใส่ `127.0.0.1` / `localhost` ที่คุณเปิด server เอง
- ใช้สังเกตอาการ (connection ค้าง, latency สูง, timeout) แล้วฝึกตั้งค่า mitigation

## ไม่อนุญาต

- ยิงไปยัง host server หรือบริการของผู้อื่นโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
- ใช้เป็นเครื่องมือก่อกวน / DDoS จริง

`slowloris-lab.py` จะ **ปฏิเสธ** เป้าหมายที่ไม่ใช่ loopback โดยค่าเริ่มต้น

## Mitigation ที่ควรฝึกหลัง demo

1. `client_header_timeout` / `client_body_timeout` บน NGINX
2. `limit_conn` ต่อ IP
3. วาง reverse proxy หน้า origin
4. มอนิเตอร์จำนวน connections สูงผิดปกติ

ดู config รวมใน `../nginx/production-https.conf`
