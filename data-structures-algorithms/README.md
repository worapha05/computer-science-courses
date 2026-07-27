# Zero to Expert: Data Structures & Algorithms Bootcamp

Bootcamp สำหรับเรียนรู้ Data Structures และ Algorithms จากศูนย์จนถึงระดับพร้อมสอบ Technical Interview ของบริษัทซอฟต์แวร์ชั้นนำ

## เป้าหมาย

เมื่อจบคอร์สนี้ คุณจะสามารถ:

- วิเคราะห์ **Time / Space Complexity** ด้วย Big O ได้อย่างมั่นใจ
- Implement Data Structure พื้นฐานถึงขั้นสูงได้จากศูนย์
- เลือก Algorithmic Paradigm ที่เหมาะสมกับโจทย์
- แก้โจทย์แนว LeetCode / HackerRank ด้วยวิธีคิดแบบ Systematic
- สื่อสาร Solution ในการสัมภาษณ์อย่างชัดเจน (Approach → Complexity → Code → Edge Cases)

## โครงสร้างหลักสูตร

| Level               | folder                                   | เนื้อหาหลัก                                                    | ระยะเวลาแนะนำ |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------- | ------------- |
| **1. Beginner**     | [`01-beginner/`](./01-beginner/)         | Big O, Arrays, Linked Lists, Stack, Queue, Searching & Sorting | 2–3 สัปดาห์   |
| **2. Intermediate** | [`02-intermediate/`](./02-intermediate/) | Hash Tables, Trees, Graphs, BFS/DFS, Recursion, D&C, Greedy    | 3–4 สัปดาห์   |
| **3. Expert**       | [`03-expert/`](./03-expert/)             | Dijkstra, MST, Topological Sort, DP, Interview Patterns        | 4–6 สัปดาห์   |

แต่ละ Level ประกอบด้วย:

1. **`README.md`** — ทฤษฎี คอนเซปต์ Complexity Analysis และ Best Practices (ภาษาไทย)
2. **`src/`** — โค้ดตัวอย่าง Clean Implementation ด้วย Python
3. **`LAB.md`** — โจทย์สถานการณ์จำลอง พร้อมเฉลย Naive + Optimized ทีละสเต็ป

## เส้นทางการเรียน (Learning Path)

```
Beginner       Intermediate      Expert
─────────      ────────────      ──────
Big O Notation   →  Hash Tables    →  Shortest Path (Dijkstra)
Arrays & Linked Lists →  Trees & BST    →  MST (Kruskal / Prim)
Stack & Queue   →  Graphs (Adj List/Matrix) →  Topological Sort
Two Pointers   →  BFS / DFS    →  Dynamic Programming
Binary Search   →  Recursion    →  Sliding Window
Bubble/Insertion/Select →  Merge/Quick Sort   →  Fast & Slow Pointers
       Greedy Approach   →  Backtracking
                Heap / Top-K
                Performance Hardening
```

## ข้อกำหนด

- Python 3.10+ (แนะนำ)
- ความรู้พื้นฐาน programming: ตัวแปร, เงื่อนไข, loop, function
- ไม่จำเป็นต้องรู้ DSA มาก่อน

### รันโค้ดตัวอย่าง

```bash
cd data-structures-algorithms-bootcamp/01-beginner/src
python3 array.py
python3 linked_list.py
# ... รันไฟล์อื่นได้เช่นกัน
```

## วิธีใช้ Bootcamp อย่างมีประสิทธิภาพ

1. **อ่าน README** ของ Level นั้นให้จบก่อนลงมือเขียนโค้ด
2. **อ่านและรันโค้ดใน `src/`** — ลองแก้ ลองเพิ่ม method เอง
3. **ทำ LAB โดยไม่ดูเฉลยก่อน** — จำกัดเวลา 20–40 นาทีต่อข้อ
4. **เปรียบเทียบ Naive vs Optimized** — โฟกัสที่ _ทำไม_ Optimized เร็วกว่า
5. **ทบทวน Complexity** ของทุก Solution ที่เขียน

## ความสัมพันธ์กับ Technical Interview

| หัวข้อใน Bootcamp                | ปรากฏใน Interview บ่อยแค่ไหน |
| -------------------------------- | ---------------------------- |
| Arrays / Hash Map / Two Pointers | ★★★★★                        |
| Sliding Window / Binary Search   | ★★★★★                        |
| Trees / BFS / DFS                | ★★★★☆                        |
| Dynamic Programming              | ★★★★☆                        |
| Graphs / Shortest Path           | ★★★☆☆                        |
| Heap / Top-K / Backtracking      | ★★★★☆                        |
