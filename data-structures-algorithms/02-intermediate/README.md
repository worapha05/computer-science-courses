# Level 2: Intermediate — Non-Linear Structures & Algorithmic Paradigms

ระดับกลางที่เปลี่ยนจากโครงสร้างเชิงเส้นไปสู่ Tree, Graph และกระบวนทัศน์ algorithm หลัก

---

## สารบัญ

1. [Hash Tables & Collections](#1-hash-tables--collections)
2. [Binary Trees & Traversals](#2-binary-trees--traversals)
3. [Binary Search Trees (BST)](#3-binary-search-trees-bst)
4. [Graphs: Adjacency List vs Matrix](#4-graphs-adjacency-list-vs-matrix)
5. [BFS & DFS](#5-bfs--dfs)
6. [Recursion Fundamentals](#6-recursion-fundamentals)
7. [Divide and Conquer: Merge Sort & Quick Sort](#7-divide-and-conquer-merge-sort--quick-sort)
8. [Greedy Approach](#8-greedy-approach)
9. [Best Practices](#9-best-practices)

---

## 1. Hash Tables & Collections

### กลไก Hashing

Hash Table แปลง key → index ใน array ผ่าน **hash function**

```
index = hash(key) % capacity
```

ทำให้ average lookup/insert/delete เป็น **O(1)**

### Collision Resolution

เมื่อ key คนละตัวได้ index เดียวกัน:

| วิธี                | แนวคิด                                                     | ข้อดี / ข้อเสีย                       |
| ------------------- | ---------------------------------------------------------- | ------------------------------------- |
| **Chaining**        | แต่ละ bucket เป็น Linked List ของ entries                  | ง่าย, degrade เป็น O(n) ถ้า hash แย่  |
| **Open Addressing** | หาช่องว่างถัดไป (linear/quadratic probing, double hashing) | Cache-friendly, ต้องจัดการ clustering |

### Load Factor

```
α = n / capacity
```

เมื่อ α สูงเกินไป → rehash ขยายตาราง (มัก 2×) เพื่อรักษา O(1) amortized

### Hash Map vs Hash Set

- **Map (dict)**: key → value
- **Set**: เก็บแค่ key เพื่อเช็ค membership

### Complexity (Average / Worst)

| Operation | Average | Worst (poor hash / all collide) |
| --------- | ------- | ------------------------------- |
| Insert    | O(1)    | O(n)                            |
| Lookup    | O(1)    | O(n)                            |
| Delete    | O(1)    | O(n)                            |

ดูโค้ด: [`src/hash_table.py`](./src/hash_table.py)

---

## 2. Binary Trees & Traversals

### คอนเซปต์

Binary Tree: แต่ละ node มีลูกได้สูงสุด 2 ตัว (left, right)

```
  1
  / \
  2 3
  / \
 4 5
```

### Traversals

| ชื่อ            | ลำดับ               | ผลลัพธ์จากต้นไม้ด้านบน | Use case                    |
| --------------- | ------------------- | ---------------------- | --------------------------- |
| **Pre-order**   | Root → Left → Right | 1,2,4,5,3              | Serialize, copy tree        |
| **In-order**    | Left → Root → Right | 4,2,5,1,3              | ใน BST ได้ลำดับ sorted      |
| **Post-order**  | Left → Right → Root | 4,5,2,3,1              | ลบ tree, คำนวณจากล่างขึ้นบน |
| **Level-order** | ทีละระดับ (BFS)     | 1,2,3,4,5              | พิมพ์ตามชั้น                |

### Complexity

- Traverse ทั้งต้น: **O(n)** time, O(h) space โดย h = ความสูง (worst O(n) ถ้าเอียง, O(log n) ถ้าสมดุล)

ดูโค้ด: [`src/binary_tree.py`](./src/binary_tree.py)

---

## 3. Binary Search Trees (BST)

### Invariant

สำหรับทุก node:

- ค่าใน left subtree **ทั้งหมด** < node
- ค่าใน right subtree **ทั้งหมด** > node

### Operations

| Operation | Average (balanced) | Worst (skewed) |
| --------- | ------------------ | -------------- |
| Search    | O(log n)           | O(n)           |
| Insert    | O(log n)           | O(n)           |
| Delete    | O(log n)           | O(n)           |

**ทำไม worst ถึงเป็น O(n)?** ถ้า insert ข้อมูลเรียงแล้ว BST จะกลายเป็น Linked List

> ในระบบจริงใช้ Self-balancing BST (AVL, Red-Black) หรือ skip ไปใช้ Hash Map ถ้าไม่ต้องการ order

ดูโค้ด: [`src/bst.py`](./src/bst.py)

---

## 4. Graphs: Adjacency List vs Matrix

### Graph คืออะไร?

เซตของ **Vertices (V)** และ **Edges (E)**
อาจเป็น Directed/Undirected, Weighted/Unweighted

### Adjacency List vs Matrix

|                    | Adjacency List     | Adjacency Matrix                  |
| ------------------ | ------------------ | --------------------------------- |
| Space              | O(V + E)           | O(V²)                             |
| เช็คว่ามี edge u→v | O(degree(u))       | O(1)                              |
| ไล่เพื่อนบ้านของ u | O(degree(u))       | O(V)                              |
| เหมาะเมื่อ         | Graph บาง (sparse) | Graph หนา (dense), เช็ค edge บ่อย |

**กฎง่ายๆ:** ถ้า E ใกล้ V² → Matrix; ถ้า E ใกล้ V → List (กรณีส่วนใหญ่ใน interview)

ดูโค้ด: [`src/graph.py`](./src/graph.py)

---

## 5. BFS & DFS

### Breadth-First Search (BFS)

สำรวจทีละระดับด้วย **Queue**

- ใช้หา **shortest path ใน unweighted graph**
- Time: O(V + E), Space: O(V)

### Depth-First Search (DFS)

เดินลึกสุดก่อนด้วย **Stack** (หรือ recursion)

- ใช้ detect cycle, topological ideas, connected components, path existence
- Time: O(V + E), Space: O(V) สำหรับ visited + call stack

### เปรียบเทียบสั้นๆ

|                            | BFS                     | DFS               |
| -------------------------- | ----------------------- | ----------------- |
| Data structure             | Queue                   | Stack / Recursion |
| Shortest path (unweighted) | ใช่                     | ไม่รับประกัน      |
| Memory บน bushy tree       | สูงกว่า (เก็บทั้งระดับ) | ต่ำกว่าโดยเฉลี่ย  |

ดูโค้ด: [`src/bfs_dfs.py`](./src/bfs_dfs.py)

---

## 6. Recursion Fundamentals

### ส่วนประกอบที่ต้องมี

1. **Base case** — เงื่อนไขหยุด
2. **Recursive case** — เรียกตัวเองด้วยปัญหาย่อยที่เล็กลง
3. **Progress** — ต้องเข้าใกล้ base case ทุกครั้ง ไม่งั้น stack overflow

### Call Stack

แต่ละครั้งที่เรียก recursive จะ push frame ใหม่
Depth สูงสุด ≈ space complexity ของ recursion

### เมื่อไหร่ใช้ Recursion?

- ปัญหาที่นิยามแบบ recursive โดยธรรมชาติ (Tree, Divide & Conquer)
- Backtracking
- ระวัง: บางภาษาจำกัด call stack (~1000 ใน Python default)

ดูโค้ด: [`src/recursion.py`](./src/recursion.py)

---

## 7. Divide and Conquer: Merge Sort & Quick Sort

### หลักการ

1. **Divide** — แบ่งปัญหาเป็นส่วนย่อย
2. **Conquer** — แก้ส่วนย่อย (recursive)
3. **Combine** — รวมคำตอบ

### Merge Sort

- แบ่งครึ่ง → sort → merge
- Time: **เสมอ O(n log n)**
- Space: O(n)
- Stable

### Quick Sort

- เลือก pivot → partition → sort ซ้าย/ขวา
- Average: O(n log n), Worst: O(n²) (pivot แย่)
- Space: O(log n) average สำหรับ call stack
- In-place ได้, ไม่ stable (มาตรฐาน)

|                  | Merge Sort                          | Quick Sort                       |
| ---------------- | ----------------------------------- | -------------------------------- |
| Worst time       | O(n log n)                          | O(n²)                            |
| Extra space      | O(n)                                | O(log n)                         |
| Stable           | Yes                                 | No                               |
| Cache / practice | ดีสำหรับ linked list, external sort | มักเร็วกว่าบน array ในทางปฏิบัติ |

ดูโค้ด: [`src/merge_sort.py`](./src/merge_sort.py), [`src/quick_sort.py`](./src/quick_sort.py)

---

## 8. Greedy Approach

### คอนเซปต์

ในแต่ละขั้นเลือกตัวเลือกที่ **ดีที่สุดในท้องถิ่น (locally optimal)** โดยหวังว่าจะนำไปสู่คำตอบที่ดีที่สุดโดยรวม

### เมื่อ Greedy ใช้ได้

ต้องพิสูจน์ได้ว่าปัญหามี:

- **Greedy choice property** — เลือกแบบ greedy แล้วไม่พลาดคำตอบที่ดีที่สุด
- **Optimal substructure** — คำตอบดีสุดประกอบด้วยคำตอบดีสุดของปัญหาย่อย

### ตัวอย่าง classic

- Activity Selection / Meeting Rooms (เลือกจบเร็วสุด)
- Fractional Knapsack (value/weight สูงสุดก่อน)
- Huffman Coding
- Coin Change เมื่อระบบเหรียญเป็น canonical (เช่น US coins) — **ระวัง:** ไม่ใช่ทุกชุดเหรียญที่ greedy ถูก!

ดูโค้ด: [`src/greedy.py`](./src/greedy.py)

---

## 9. Best Practices

| สถานการณ์                               | เลือกใช้                     | เหตุผล                |
| --------------------------------------- | ---------------------------- | --------------------- |
| Lookup/insert บ่อย ไม่สนใจลำดับ         | Hash Map / Set               | O(1) average          |
| ต้องการข้อมูลเรียง + search             | BST / TreeMap                | O(log n) + ordered    |
| Shortest path แบบไม่ถ่วงน้ำหนัก         | BFS                          | ถูกต้องและง่าย        |
| สำรวจทุก path / detect cycle            | DFS                          | ธรรมชาติของ recursion |
| Sort ทั่วไปต้องการ stable + predictable | Merge Sort / Tim Sort        | Worst = O(n log n)    |
| Sort in-place บน array                  | Quick Sort (หรือ intro sort) | เร็วในทางปฏิบัติ      |
| ปัญหาเลือกทีละขั้นแบบพิสูจน์ได้         | Greedy                       | ง่ายและเร็ว           |
| ไม่แน่ใจว่า greedy ถูก                  | อย่าใช้ — ไป DP/search       | ผิดเงียบๆ ได้ง่าย     |

### Mental Model สำหรับ Interview

```
เห็น "หาคู่ / นับความถี่ / มีอยู่ไหม?" → Hash Map
เห็น Tree → Traversal (ระบุ Pre/In/Post/Level)
เห็น Grid / Network → Graph + BFS/DFS
เห็น "minimum/maximum ทีละขั้น" → พิจารณา Greedy แล้วพิสูจน์
เห็น "แบ่งครึ่งแล้วรวม" → Divide & Conquer
```

---

## ไฟล์ใน Level นี้

```
02-intermediate/
├── README.md
├── LAB.md
└── src/
    ├── hash_table.py
    ├── binary_tree.py
    ├── bst.py
    ├── graph.py
    ├── bfs_dfs.py
    ├── recursion.py
    ├── merge_sort.py
    ├── quick_sort.py
    └── greedy.py
```

## ขั้นตอนถัดไป

จบ LAB Intermediate แล้ว → [`../03-expert/`](../03-expert/)
