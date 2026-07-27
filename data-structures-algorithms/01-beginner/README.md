# Level 1: Beginner — Complexity Foundations & Linear Data Structures

ระดับเริ่มต้นสำหรับสร้างฐานแข็งแรงก่อนเข้าสู่โครงสร้างข้อมูลที่ซับซ้อนขึ้น

---

## สารบัญ

1. [Algorithmic Analysis & Big O Notation](#1-algorithmic-analysis--big-o-notation)
2. [Arrays](#2-arrays)
3. [Linked Lists](#3-linked-lists)
4. [Stacks (LIFO)](#4-stacks-lifo)
5. [Queues (FIFO)](#5-queues-fifo)
6. [Two Pointers](#6-two-pointers)
7. [Binary Search](#7-binary-search)
8. [Basic Sorting Algorithms](#8-basic-sorting-algorithms)
9. [Best Practices: เมื่อไหร่ควรใช้อะไร](#9-best-practices-เมื่อไหร่ควรใช้อะไร)

---

## 1. Algorithmic Analysis & Big O Notation

### Big O คืออะไร?

**Big O Notation** คือภาษาที่ใช้พูดถึงว่า algorithm "โต" อย่างไรเมื่อ input ใหญ่ขึ้น โดยมองที่ **worst-case asymptotic growth** — คือเมื่อ `n → ∞` เราสนใจเฉพาะพจน์ที่โตเร็วที่สุด และตัดค่าคงที่ทิ้ง

ตัวอย่าง: ถ้า function ใช้เวลา `3n² + 100n + 50` เราเขียนว่า **O(n²)** เพราะเมื่อ n ใหญ่ `n²` จะครอบงำพจน์อื่นทั้งหมด

### Complexity ที่ต้องจำให้ขึ้นใจ

| Big O          | ชื่อ         | ความหมายโดยคร่าว                       | ตัวอย่าง                                          |
| -------------- | ------------ | -------------------------------------- | ------------------------------------------------- |
| **O(1)**       | Constant     | ใช้เวลาคงที่ ไม่ว่า input จะใหญ่แค่ไหน | Access array ด้วย index, Hash Map lookup (เฉลี่ย) |
| **O(log n)**   | Logarithmic  | ตัดปัญหาครึ่งหนึ่งทุกครั้ง             | Binary Search                                     |
| **O(n)**       | Linear       | วนผ่านข้อมูลทีละตัว                    | Linear Search, วน array ครั้งเดียว                |
| **O(n log n)** | Linearithmic | แบ่งแล้วรวม แบบ efficient sort         | Merge Sort, Heap Sort, Tim Sort                   |
| **O(n²)**      | Quadratic    | loop ซ้อน loop                         | Bubble Sort, เปรียบเทียบทุกคู่                    |

### Time Complexity vs Space Complexity

- **Time Complexity** — จำนวน operations ที่โตตามขนาด input
- **Space Complexity** — หน่วยความจำเพิ่มเติมที่ใช้นอกเหนือจาก input เดิม

ตัวอย่าง: Merge Sort ใช้เวลา O(n log n) แต่ต้องการ space เพิ่ม O(n) ในขณะที่ Heap Sort ใช้เวลา O(n log n) และ space O(1) (in-place)

### วิธีวิเคราะห์ทีละขั้น

```python
def example(arr):                     # n = len(arr)
    total = 0                         # O(1)
    for x in arr:                     # วน n ครั้ง → O(n)
        total += x                    # O(1) ต่อรอบ
    for i in range(n):                # O(n)
        for j in range(n):            # O(n) ซ้อน → O(n²)
            print(i, j)
    return total                      # รวม: O(n) + O(n²) = O(n²)
```

**กฎสำคัญ:**

- Sequential → เอาตัวที่โตเร็วสุด
- Nested → คูณกัน
- Independent loops → บวกกัน แล้วเลือกตัวใหญ่สุด

ดูโค้ดตัวอย่างที่ [`src/big_o_examples.py`](./src/big_o_examples.py)

---

## 2. Arrays

### คอนเซปต์

Array คือโครงสร้างข้อมูลที่เก็บองค์ประกอบเรียงต่อกันในหน่วยความจำ (**contiguous memory**) ทำให้สามารถเข้าถึงด้วย index ได้ใน O(1)

### Operations และ Complexity

| Operation                  | Average | Worst | หมายเหตุ                       |
| -------------------------- | ------- | ----- | ------------------------------ |
| Access by index            | O(1)    | O(1)  | จุดแข็งหลัก                    |
| Search (unsorted)          | O(n)    | O(n)  | ต้องสแกนทั้งก้อน               |
| Insert at end (dynamic)    | O(1)*   | O(n)  | *amortized เมื่อไม่ต้อง resize |
| Insert at beginning/middle | O(n)    | O(n)  | ต้อง shift ทุกตัวหลังจุดแทรก   |
| Delete                     | O(n)    | O(n)  | ต้อง shift เช่นกัน             |

### Dynamic Array (เช่น Python `list`)

เมื่อเต็ม capacity จะ allocate ใหม่ (มักเป็น 2×) แล้ว copy ของเก่ามา → insert ที่ท้ายจึงเป็น **amortized O(1)**

ดูโค้ด: [`src/array.py`](./src/array.py)

---

## 3. Linked Lists

### คอนเซปต์

Linked List เก็บข้อมูลเป็น **Node** ที่ชี้ไปยัง Node ถัดไป ไม่จำเป็นต้องอยู่ติดกันในหน่วยความจำ

```
Singly: [data|next] → [data|next] → [data|None]
Doubly: None ← [prev|data|next] ⇄ [prev|data|next] ⇄ ... → None
```

### Singly vs Doubly

|                                   | Singly Linked List        | Doubly Linked List         |
| --------------------------------- | ------------------------- | -------------------------- |
| Memory ต่อ Node                   | น้อยกว่า (เก็บแค่ next)   | มากกว่า (prev + next)      |
| Traverse ย้อนกลับ                 | ยาก/ต้องเก็บ prev เอง     | O(n) ทำได้ตรงๆ             |
| Delete เมื่อมี pointer ไปยัง node | ต้องหา previous ก่อน O(n) | O(1) ถ้ามี pointer         |
| Use case                          | Stack, โครงสร้างเบา       | LRU Cache, Browser history |

### Operations และ Complexity

| Operation                        | Singly | Doubly | หมายเหตุ          |
| -------------------------------- | ------ | ------ | ----------------- |
| Access by index                  | O(n)   | O(n)   | ต้องเดินทีละ node |
| Insert at head                   | O(1)   | O(1)   |                   |
| Insert at tail (มี tail pointer) | O(1)   | O(1)   | ไม่มี tail = O(n) |
| Delete at head                   | O(1)   | O(1)   |                   |
| Search                           | O(n)   | O(n)   |                   |

**เมื่อไหร่ใช้ Linked List แทน Array?**

- Insert/Delete ที่หัวบ่อยมาก และไม่ต้องการ random access
- ไม่รู้ขนาดล่วงหน้า และไม่อยาก pay cost ของ resizing

ดูโค้ด: [`src/linked_list.py`](./src/linked_list.py)

---

## 4. Stacks (LIFO)

### คอนเซปต์

**Last In, First Out** — เหมือนกองจาน: เอาออกได้เฉพาะใบบนสุด

### Operations

| Operation          | Complexity | คำอธิบาย            |
| ------------------ | ---------- | ------------------- |
| `push(x)`          | O(1)       | ใส่บนสุด            |
| `pop()`            | O(1)       | เอาออกจากบนสุด      |
| `peek()` / `top()` | O(1)       | ดูบนสุดโดยไม่เอาออก |
| `is_empty()`       | O(1)       |                     |

### Use Cases ที่พบบ่อยใน Interview

- ตรวจ Balanced Parentheses `()[]{}`
- Evaluate Expression / Calculator
- Undo/Redo
- DFS (iterative) ด้วย explicit stack
- Monotonic Stack (Next Greater Element)

ดูโค้ด: [`src/stack.py`](./src/stack.py)

---

## 5. Queues (FIFO)

### คอนเซปต์

**First In, First Out** — เหมือนคิวซื้อตั๋ว: คนมาก่อนได้ออกก่อน

### Operations

| Operation            | Complexity | คำอธิบาย        |
| -------------------- | ---------- | --------------- |
| `enqueue(x)`         | O(1)       | ใส่ท้ายคิว      |
| `dequeue()`          | O(1)       | เอาออกจากหัวคิว |
| `front()` / `peek()` | O(1)       |                 |
| `is_empty()`         | O(1)       |                 |

### Variants

- **Deque (Double-ended Queue)** — ใส่/เอาออกได้ทั้งหัวและท้าย → สำคัญมากกับ Sliding Window
- **Circular Queue** — ใช้ array วนรอบประหยัด space
- **Priority Queue** — เอาออกตาม priority ไม่ใช่ลำดับเข้า (ดู Level 3)

### Use Cases

- BFS
- Task scheduling / Rate limiting
- Print queue, Message queue

ดูโค้ด: [`src/queue.py`](./src/queue.py)

---

## 6. Two Pointers

### คอนเซปต์

ใช้ pointer สองตัวเดินบน array/string พร้อมกัน เพื่อลดการวนซ้ำจาก O(n²) → O(n) ในหลายโจทย์

### รูปแบบหลัก

1. **Opposite ends** — เริ่มจากซ้ายสุดกับขวาสุด เดินเข้าหากัน
   ใช้เมื่อ: array ถูก sort แล้ว, ค้นหาคู่ที่ผลรวม = target, ตรวจ palindrome
2. **Same direction (fast/slow)** — ทั้งคู่เริ่มจากซ้าย แต่เดินคนละความเร็ว
   ใช้เมื่อ: ลบ duplicates ใน sorted array, partition

### Complexity

- Time: โดยทั่วไป **O(n)** (แต่ละ pointer เดินผ่านข้อมูลได้สูงสุดครั้งเดียว)
- Space: **O(1)** เพิ่มเติม

ดูโค้ด: [`src/two_pointers.py`](./src/two_pointers.py)

---

## 7. Binary Search

### คอนเซปต์

ค้นหาใน **sorted** collection โดยตัดช่วงค้นหาครึ่งหนึ่งทุกครั้ง

```
low = 0, high = n - 1
while low <= high:
    mid = (low + high) // 2
    if arr[mid] == target:  → found
    if arr[mid] < target:   → search right half (low = mid + 1)
    if arr[mid] > target:   → search left half (high = mid - 1)
```

### Complexity

- Time: **O(log n)**
- Space: O(1) iterative / O(log n) recursive (call stack)

### Variants ที่ต้องฝึก

- Lower bound / Upper bound (first / last occurrence)
- Search in rotated sorted array
- Binary search on answer (ค้นหาค่าที่ "พอดี" บนช่วงตัวเลข)

ดูโค้ด: [`src/binary_search.py`](./src/binary_search.py)

---

## 8. Basic Sorting Algorithms

### เปรียบเทียบ

| Algorithm          | Best  | Average | Worst | Space | Stable? | ลักษณะ                                          |
| ------------------ | ----- | ------- | ----- | ----- | ------- | ----------------------------------------------- |
| **Bubble Sort**    | O(n)  | O(n²)   | O(n²) | O(1)  | Yes     | สลับคู่ติดกันซ้ำๆ                               |
| **Selection Sort** | O(n²) | O(n²)   | O(n²) | O(1)  | No*     | หา min แล้วสลับไปตำแหน่งถัดไป                   |
| **Insertion Sort** | O(n)  | O(n²)   | O(n²) | O(1)  | Yes     | แทรกแต่ละตัวเข้าตำแหน่งที่ถูกในส่วนที่เรียงแล้ว |

> *Selection Sort สามารถทำให้ stable ได้แต่ implementation มาตรฐานไม่ stable

### เมื่อไหร่ยังมีประโยชน์?

- **Insertion Sort**: ข้อมูลเกือบเรียงแล้ว หรือ n เล็กมาก (จริงๆ Tim Sort ใน Python ใช้ insertion สำหรับช่วงเล็ก)
- **Bubble / Selection**: ใช้สอนคอนเซปต์ ไม่ใช้ใน production สำหรับข้อมูลใหญ่

ดูโค้ด: [`src/sorting.py`](./src/sorting.py)

---

## 9. Best Practices: เมื่อไหร่ควรใช้อะไร

| สถานการณ์                           | เลือกใช้            | เหตุผล                |
| ----------------------------------- | ------------------- | --------------------- |
| Random access ตาม index บ่อย        | Array / List        | O(1) access           |
| Insert/Delete ที่หัวบ่อย            | Linked List / Deque | O(1) ที่หัว           |
| Undo, nested structure, parentheses | Stack               | LIFO ตรงโจทย์         |
| BFS, scheduling ตามลำดับเข้า        | Queue               | FIFO                  |
| ค้นในข้อมูลที่ sort แล้ว            | Binary Search       | O(log n)              |
| หาคู่ผลรวมใน sorted array           | Two Pointers        | O(n) แทน O(n²)        |
| n เล็ก / ข้อมูลเกือบเรียง           | Insertion Sort      | ง่าย + เร็วพอ         |
| ต้องการ sort ทั่วไป                 | built-in (`sorted`) | Tim Sort = O(n log n) |

### Checklist ก่อนเขียนโค้ดทุกครั้ง

1. Input มี sorted อยู่แล้วหรือเปล่า?
2. ต้องการ random access หรือแค่ sequential?
3. Time budget คืออะไร? (O(n) พอไหม หรือต้อง O(log n)?)
4. Edge cases: empty, ตัวเดียว, ซ้ำทั้งหมด, overflow?

---

## ไฟล์ใน Level นี้

```
01-beginner/
├── README.md       ← คุณอยู่ที่นี่
├── LAB.md          ← โจทย์ + เฉลย
└── src/
    ├── big_o_examples.py
    ├── array.py
    ├── linked_list.py
    ├── stack.py
    ├── queue.py
    ├── two_pointers.py
    ├── binary_search.py
    └── sorting.py
```

## ขั้นตอนถัดไป

เมื่อทำ LAB ของ Beginner จบแล้ว และอธิบาย Complexity ของทุกข้อได้ → ไปต่อที่ [`../02-intermediate/`](../02-intermediate/)
