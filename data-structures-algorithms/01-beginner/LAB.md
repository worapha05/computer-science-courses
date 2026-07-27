# Level 1 LAB — Beginner Challenges

โจทย์สถานการณ์จำลองแนว LeetCode/HackerRank
**กฎ:** ลองแก้เองอย่างน้อย 20 นาทีก่อนดูเฉลย และเขียน Complexity ของทุก solution

---

## LAB 1: คู่ตัวเลขที่ผลรวมตรงเป้า (Two Sum — Sorted)

### สถานการณ์

ระบบ payment gateway ได้รับรายการยอดเงินที่ **เรียงจากน้อยไปมาก** แล้ว
คุณต้องหา **สองรายการ** ที่ผลรวมเท่ากับ `target` พอดี เพื่อจับคู่ refund

### Input / Output

```
Input: amounts = [2, 7, 11, 15], target = 9
Output: [0, 1] # เพราะ 2 + 7 = 9

Input: amounts = [1, 2, 3, 4, 6], target = 10
Output: [3, 4] # 4 + 6 = 10
```

Constraint: มีคำตอบเพียงคู่เดียว, index เริ่มที่ 0, ห้ามใช้ตัวเดิมสองครั้ง

---

### วิธีคิด — Naive O(n²)

วนคู่ทุก `(i, j)` ที่ `i < j` แล้วเช็คว่าผลรวม = target

```python
def two_sum_naive(amounts: list[int], target: int) -> list[int]:
    n = len(amounts)
    for i in range(n):
        for j in range(i + 1, n):
            if amounts[i] + amounts[j] == target:
                return [i, j]
    return []
```

- **Time:** O(n²) — เปรียบเทียบทุกคู่
- **Space:** O(1)

---

### วิธีคิด — Optimized O(n) ด้วย Two Pointers

เพราะ array **เรียงแล้ว** ใช้ left/right:

1. `left = 0`, `right = n - 1`
2. ถ้าผลรวม < target → ขยับ left ไปขวา (ต้องการตัวใหญ่ขึ้น)
3. ถ้าผลรวม > target → ขยับ right ไปซ้าย
4. เท่ากัน → พบคำตอบ

```python
def two_sum_optimized(amounts: list[int], target: int) -> list[int]:
    left, right = 0, len(amounts) - 1
    while left < right:
        total = amounts[left] + amounts[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []
```

- **Time:** O(n) — แต่ละ pointer เดินได้สูงสุด n ครั้ง
- **Space:** O(1)

> ถ้า array **ไม่ได้เรียง** ให้ใช้ Hash Map (ดู Intermediate) แทน Two Pointers

---

## LAB 2: ตรวจความสมดุลของวงเล็บใน Config File

### สถานการณ์

Config parser ของระบบต้อง validate ว่า string ของ nested config มีวงเล็บ `()[]{}` สมดุลหรือไม่

### Input / Output

```
Input: "{[()]}"
Output: True

Input: "{[(])}"
Output: False

Input: "((("
Output: False
```

---

### วิธีคิด — Naive (นับอย่างเดียว — ไม่พอ!)

การนับจำนวน `(` กับ `)` แยกกัน **ไม่พอ** เพราะ `([)]` มีจำนวนเท่ากันแต่ไม่ valid
ต้องใช้ Stack เพื่อจำลำดับการเปิด

---

### วิธีคิด — Optimized ด้วย Stack O(n)

1. เจอวงเล็บเปิด → push ลง stack
2. เจอวงเล็บปิด → pop แล้วเช็คว่าคู่กันไหม
3. จบแล้ว stack ต้องว่าง

```python
def is_valid_brackets(s: str) -> bool:
    pairs = {')': '(', ']': '[', '}': '{'}
    stack: list[str] = []

    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in ')]}':
            if not stack or stack.pop() != pairs[ch]:
                return False
    return len(stack) == 0
```

- **Time:** O(n)
- **Space:** O(n) worst case (เปิดทั้งหมด)

**Edge cases:** string ว่าง → True, ปิดก่อนเปิด → False, เปิดค้าง → False

---

## LAB 3: ค้นหา version แรกที่พัง (First Bad Version)

### สถานการณ์

CI/CD มี build หมายเลข `1..n` บาง version เริ่มพังและ version หลังๆ พังทั้งหมด
มี function `is_bad(version) -> bool` ที่แพง คุณต้องหา **first bad version** ด้วยการเรียกให้น้อยที่สุด

### Input / Output

```
n = 5, bad starts at 4
is_bad: 1→F, 2→F, 3→F, 4→T, 5→T
Output: 4
```

---

### วิธีคิด — Naive O(n)

ไล่จาก 1 ถึง n เรียก `is_bad` ทีละตัว

```python
def first_bad_naive(n: int, is_bad) -> int:
    for v in range(1, n + 1):
        if is_bad(v):
            return v
    return -1
```

---

### วิธีคิด — Optimized O(log n) Binary Search

Property: `False False ... False True True ... True`
หา lower bound ของ True

```python
def first_bad_optimized(n: int, is_bad) -> int:
    low, high = 1, n
    answer = n
    while low <= high:
        mid = low + (high - low) // 2
        if is_bad(mid):
            answer = mid
            high = mid - 1  # ยังอาจมีตัวพังที่เล็กกว่า
        else:
            low = mid + 1
    return answer
```

- **Time:** O(log n) การเรียก `is_bad`
- **Space:** O(1)

---

## LAB 4: รวมคิวออเดอร์สองร้าน (Merge Two Sorted Lists)

### สถานการณ์

platform food delivery มีออเดอร์จากสองร้านที่เรียงตาม timestamp แล้ว
ต้องรวมเป็นคิวเดียวที่ยังเรียงอยู่

### Input / Output

```
list1 = [1, 2, 4]
list2 = [1, 3, 4]
Output: [1, 1, 2, 3, 4, 4]
```

(ใน LAB นี้ใช้ Python list แทน Linked List เพื่อโฟกัส algorithm; ใน production มักเป็น Linked List nodes)

---

### วิธีคิด — Naive O((n+m) log(n+m))

concat แล้ว sort

```python
def merge_naive(a: list[int], b: list[int]) -> list[int]:
    return sorted(a + b)
```

ถูก แต่เสียประโยชน์ที่ข้อมูลเรียงอยู่แล้ว

---

### วิธีคิด — Optimized O(n+m) Two Pointers

```python
def merge_optimized(a: list[int], b: list[int]) -> list[int]:
    i = j = 0
    result: list[int] = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            result.append(a[i])
            i += 1
        else:
            result.append(b[j])
            j += 1
    result.extend(a[i:])
    result.extend(b[j:])
    return result
```

- **Time:** O(n + m)
- **Space:** O(n + m) สำหรับผลลัพธ์ (จำเป็น)

---

## LAB 5: จำลอง Undo ใน Text Editor (Stack)

### สถานการณ์

สร้าง mini text editor ที่รองรับ:

- `TYPE x` — พิมพ์ตัวอักษร x ต่อท้าย
- `UNDO` — ยกเลิกคำสั่งล่าสุด

### Input / Output

```
ops = ["TYPE a", "TYPE b", "TYPE c", "UNDO", "TYPE d"]
Output: "abd"
```

---

### วิธีคิด

ใช้ Stack เก็บประวัติการกระทำ แต่ละ TYPE push ตัวอักษร, UNDO = pop

```python
def editor(ops: list[str]) -> str:
    stack: list[str] = []
    for op in ops:
        if op.startswith("TYPE "):
            stack.append(op[-1])
        elif op == "UNDO":
            if stack:
                stack.pop()
    return "".join(stack)
```

- **Time:** O(k) เมื่อ k = จำนวน operations
- **Space:** O(k)

**ขยายความคิด:** เพิ่ม `REDO` ได้ด้วยการมี undo stack + redo stack สองอัน

---

## LAB 6: เรียงคะแนนสอบชุดเล็ก (Insertion Sort Practice)

### สถานการณ์

ครูมีคะแนนนักเรียน 8 คน ที่เกือบเรียงแล้ว (มีสลับแค่ 1–2 คู่)
Implement Insertion Sort และอธิบายว่าทำไมถึงเหมาะกว่า Bubble ในเคสนี้

### เฉลยแนวคิด

Insertion Sort เป็น **adaptive** — ถ้าข้อมูลเกือบเรียง จำนวนการ shift จะน้อยมาก → ใกล้ O(n)
Bubble แม้มี early-exit ก็ยังอาจต้องเปรียบเทียบหลายรอบ

```python
def insertion_sort(scores: list[int]) -> list[int]:
    a = scores[:]
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a
```

---

## สรุป Checklist ก่อนขึ้น Intermediate

- [ ] อธิบาย O(1), O(log n), O(n), O(n log n), O(n²) พร้อมตัวอย่างได้
- [ ] Implement Stack / Queue / Linked List จากศูนย์ได้
- [ ] ใช้ Two Pointers กับ sorted array ได้
- [ ] เขียน Binary Search (รวม lower bound) โดยไม่มี off-by-one
- [ ] ทำ LAB 1–5 ได้โดยไม่ดูเฉลย

พร้อมแล้ว → [`../02-intermediate/LAB.md`](../02-intermediate/LAB.md)
