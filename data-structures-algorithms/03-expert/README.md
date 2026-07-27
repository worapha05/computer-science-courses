# Level 3: Expert — Advanced Graph, Dynamic Programming & Interview Patterns

ระดับสูงสำหรับ Technical Interview และการออกแบบ algorithm ที่ scale ได้

---

## สารบัญ

1. [Shortest Path: Dijkstra](#1-shortest-path-dijkstra)
2. [Minimum Spanning Tree: Kruskal & Prim](#2-minimum-spanning-tree-kruskal--prim)
3. [Topological Sorting](#3-topological-sorting)
4. [Dynamic Programming Fundamentals](#4-dynamic-programming-fundamentals)
5. [Classic DP: Knapsack & LCS](#5-classic-dp-knapsack--lcs)
6. [Sliding Window](#6-sliding-window)
7. [Fast & Slow Pointers (Floyd)](#7-fast--slow-pointers-floyd)
8. [Backtracking](#8-backtracking)
9. [Heap / Priority Queue — Top K](#9-heap--priority-queue--top-k)
10. [Performance Hardening & Edge Cases](#10-performance-hardening--edge-cases)
11. [Best Practices สรุประดับ Expert](#11-best-practices-สรุประดับ-expert)

---

## 1. Shortest Path: Dijkstra

### คอนเซปต์

หา shortest path จาก source ไปยังทุก node ใน **weighted graph ที่มีน้ำหนัก ≥ 0**

### กลไก

1. ตั้ง `dist[source] = 0`, อื่นๆ = ∞
2. ใช้ Min-Heap ดึง node ที่ระยะสั้นสุดที่ยังไม่ finalize
3. Relax ทุก edge ที่ออกจาก node นั้น
4. ทำซ้ำจน heap ว่าง

### Complexity

ด้วย Binary Heap: **O((V + E) log V)**
Space: O(V)

### ข้อจำกัดสำคัญ

- **ห้ามใช้กับ negative weights** → ใช้ Bellman-Ford แทน
- Negative cycle → ไม่มี shortest path ที่นิยามได้

ดูโค้ด: [`src/dijkstra.py`](./src/dijkstra.py)

---

## 2. Minimum Spanning Tree: Kruskal & Prim

### MST คืออะไร?

subgraph ที่เชื่อมทุก node โดยไม่มี cycle และผลรวมน้ำหนัก edge **น้อยที่สุด**

### Kruskal

1. Sort edges ตามน้ำหนัก
2. เพิ่ม edge ถ้าไม่เกิด cycle (ใช้ Union-Find / Disjoint Set)
3. หยุดเมื่อได้ V−1 edges

**Time:** O(E log E)

### Prim

คล้าย Dijkstra: ขยายต้นไม้จาก node เริ่ม โดยเลือก edge ถูกสุดที่เชื่อมไปยัง node ใหม่

**Time:** O((V + E) log V) ด้วย heap

|                | Kruskal      | Prim                           |
| -------------- | ------------ | ------------------------------ |
| เหมาะกับ       | Sparse graph | Dense graph / adjacency matrix |
| โครงสร้างเสริม | Union-Find   | Priority Queue                 |

ดูโค้ด: [`src/mst.py`](./src/mst.py)

---

## 3. Topological Sorting

### คอนเซปต์

เรียงลำดับ node ใน **Directed Acyclic Graph (DAG)** ให้ทุก edge u→v มี u มาก่อน v

### Use Cases

- ลำดับการ build / compile dependencies
- Course prerequisites
- Task scheduling with dependencies

### สองวิธีหลัก

1. **Kahn's Algorithm (BFS)**: เริ่มจาก node ที่ in-degree = 0
2. **DFS post-order**: หลังเยี่ยมลูกครบแล้วค่อยใส่ node ลงผลลัพธ์ (แล้ว reverse)

ถ้าพบ cycle → ไม่มี topological order

ดูโค้ด: [`src/topological_sort.py`](./src/topological_sort.py)

---

## 4. Dynamic Programming Fundamentals

### สองเงื่อนไขที่ต้องมี

1. **Optimal Substructure** — คำตอบดีสุดสร้างจากคำตอบดีสุดของปัญหาย่อย
2. **Overlapping Subproblems** — ปัญหาย่อยถูกคำนวณซ้ำ → ควรจำผล

### Memoization (Top-Down) vs Tabulation (Bottom-Up)

|                | Memoization                 | Tabulation                      |
| -------------- | --------------------------- | ------------------------------- |
| ทิศทาง         | เริ่มจากปัญหาใหญ่ เรียกย่อย | เริ่มจากฐาน สร้างขึ้นไป         |
| Implementation | Recursion + cache           | Loop เติมตาราง                  |
| คำนวณ          | เฉพาะ state ที่จำเป็น       | ทุก state ในช่วง                |
| Debug          | ธรรมชาติตามนิยามปัญหา       | มักเร็วกว่า / ไม่มี stack limit |

### ขั้นตอนคิด DP ใน Interview

1. นิยาม state: `dp[i]` / `dp[i][j]` หมายถึงอะไร?
2. หา recurrence relation
3. ระบุ base cases
4. เลือกลำดับการคำนวณ
5. ระบุคำตอบสุดท้ายอยู่ที่ state ไหน
6. Optimize space ถ้าทำได้ (เช่น เหลือแค่แถวก่อนหน้า)

---

## 5. Classic DP: Knapsack & LCS

### 0/1 Knapsack

มีของ n ชิ้น แต่ละชิ้นน้ำหนัก `w[i]` มูลค่า `v[i]` เป้จุได้ `W`
เลือก/ไม่เลือกแต่ละชิ้น (ห้ามหักเศษ) ให้มูลค่ารวมสูงสุด

```
dp[i][cap] = max(
    dp[i-1][cap],                 # ไม่เอาชิ้น i
    dp[i-1][cap - w[i]] + v[i]   # เอาชิ้น i (ถ้าใส่ได้)
)
```

Time/Space: O(nW) — **pseudo-polynomial**

### Longest Common Subsequence (LCS)

หาความยาว subsequence ร่วมยาวสุดของสอง string (ไม่จำเป็นต้องติดกัน)

```
ถ้า a[i]==b[j]: dp[i][j] = dp[i-1][j-1] + 1
else:   dp[i][j] = max(dp[i-1][j], dp[i][j-1])
```

Time: O(m·n), Space: O(m·n) หรือ O(min(m,n)) หลัง optimize

ดูโค้ด: [`src/knapsack.py`](./src/knapsack.py), [`src/lcs.py`](./src/lcs.py)

---

## 6. Sliding Window

### คอนเซปต์

รักษา "หน้าต่าง" `[left, right]` บน array/string แล้วเลื่อนอย่างมีเงื่อนไข
ลดโจทย์ช่วงย่อยจาก O(n²) → O(n)

### รูปแบบ

1. **Fixed size** — หน้าต่างยาว k คงที่ (เช่น max sum ของ subarray ยาว k)
2. **Variable size** — ขยาย/หดตามเงื่อนไข (เช่น longest substring without repeating)

### Template Variable Window

```
left = 0
for right in range(n):
    # 1) เพิ่ม arr[right] เข้า window state
    # 2) ขณะที่ window ผิดเงื่อนไข: เอา arr[left] ออก, left += 1
    # 3) update คำตอบจาก window ปัจจุบัน
```

ดูโค้ด: [`src/sliding_window.py`](./src/sliding_window.py)

---

## 7. Fast & Slow Pointers (Floyd)

### คอนเซปต์

pointer สองตัวเดินคนละความเร็วบน Linked List / Cycle

### Floyd's Cycle Detection

- slow เดิน 1 ก้าว, fast เดิน 2 ก้าว
- ถ้ามี cycle → ต้องเจอกัน
- หาปาก cycle: หลังเจอ ตั้งตัวหนึ่งกลับไปหัว แล้วเดินทีละ 1 พร้อมกัน

### Use Cases อื่น

- หา middle ของ Linked List
- ตรวจ palindrome list
- Happy Number

ดูโค้ด: [`src/floyd_cycle.py`](./src/floyd_cycle.py)

---

## 8. Backtracking

### คอนเซปต์

ค้นหาแบบลองทาง (DFS) + **undo** เมื่อทางนั้นไม่ไปต่อได้
ใช้สร้าง Subsets, Permutations, Combinations, N-Queens, Sudoku

### Template

```
def backtrack(path, choices):
    if เป็นคำตอบ:
        record(path)
        return
    for choice in choices:
        if ไม่ valid: continue
        path.add(choice)     # decide
        backtrack(...)       # explore
        path.remove(choice)  # undo
```

Complexity มักเป็น exponential แต่เป็นวิธีมาตรฐานเมื่อต้อง enumerate

ดูโค้ด: [`src/backtracking.py`](./src/backtracking.py)

---

## 9. Heap / Priority Queue — Top K

### คอนเซปต์

Binary Heap ให้ insert/pop min (หรือ max) ใน O(log n) และ peek ใน O(1)

### Top-K Pattern

หา K องค์ประกอบที่ "มาก/น้อย" ที่สุดโดยไม่ต้อง full sort:

- ใช้ **Min-Heap ขนาด K** สำหรับ Top-K ใหญ่สุด
  (ถ้าเจอตัวใหญ่กว่า root → แทนที่ root)
- Time: O(n log k) ดีกว่า O(n log n) ของ full sort เมื่อ k ≪ n

ดูโค้ด: [`src/heap_topk.py`](./src/heap_topk.py)

---

## 10. Performance Hardening & Edge Cases

### Memory ใน Loops

- เลี่ยงสร้าง list/dict ใหม่ใน hot loop โดยไม่จำเป็น
- Prefer index iteration เมื่อไม่ต้อง copy
- Generator / streaming สำหรับข้อมูลใหญ่
- DP space optimization: เก็บแค่แถว/สถานะก่อนหน้า

### Edge Cases ที่ต้องเช็คทุกครั้ง

| ประเภท          | ตัวอย่าง                                                  |
| --------------- | --------------------------------------------------------- |
| Empty input     | `[]`, `""`, `None`                                        |
| ขนาด 1          | ไม่เข้า loop หลัก                                         |
| Duplicates      | ส่งผลต่อ two pointers / BST                               |
| Overflow        | `low + high` ในภาษา int จำกัด → ใช้ `low + (high-low)//2` |
| Null pointers   | Linked List / Tree children                               |
| Negative / zero | Dijkstra weights, division                                |
| Cycle           | Graph algorithms                                          |

### Scale Tips

- รู้ bottleneck จาก Complexity ก่อน micro-optimize
- Hash Map trade space เพื่อ time
- Early termination เมื่อเจอคำตอบแล้ว
- เลือก structure ให้ตรง access pattern (random vs sequential)

ดูโค้ด: [`src/performance.py`](./src/performance.py)

---

## 11. Best Practices สรุประดับ Expert

| Pattern ที่เห็นในโจทย์            | อาวุธที่ควรหยิบ    |
| --------------------------------- | ------------------ |
| Shortest path น้ำหนัก ≥ 0         | Dijkstra           |
| เชื่อมทุกจุดด้วยต้นทุนต่ำสุด      | MST (Kruskal/Prim) |
| ลำดับตาม dependency               | Topological Sort   |
| Optimal + overlapping             | DP                 |
| Subarray/substring ช่วงต่อเนื่อง  | Sliding Window     |
| Cycle ใน Linked List              | Fast/Slow          |
| Enumerate ทุกชุด/จัดเรียง         | Backtracking       |
| K อันดับหนึ่งโดยไม่ sort ทั้งก้อน | Heap               |

### Interview Communication Framework

1. **Clarify** — constraints, edge cases, expected complexity
2. **Brute force** — พูด Naive ก่อนเพื่อโชว์ความเข้าใจ
3. **Optimize** — ระบุ bottleneck แล้วเลือก pattern
4. **Code** — clean, named well, handle edges
5. **Analyze** — Time / Space สุดท้าย
6. **Test** — dry-run ตัวอย่าง + edge case

---

## ไฟล์ใน Level นี้

```
03-expert/
├── README.md
├── LAB.md
└── src/
    ├── dijkstra.py
    ├── mst.py
    ├── topological_sort.py
    ├── knapsack.py
    ├── lcs.py
    ├── sliding_window.py
    ├── floyd_cycle.py
    ├── backtracking.py
    ├── heap_topk.py
    └── performance.py
```

ยินดีด้วย — เมื่อจบ LAB Expert คุณมีฐานครบสำหรับ Software Engineer interviews ระดับสูง
