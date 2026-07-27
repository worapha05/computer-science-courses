# Level 3 LAB — Expert Challenges

โจทย์ระดับ Technical Interview
โฟกัส: เลือก pattern ให้ถูก → อธิบาย Naive → Optimize → Analyze Complexity → Edge Cases

---

## LAB 1: เส้นทางส่งของที่ถูกที่สุด (Dijkstra)

### สถานการณ์

บริษัท logistics มีคลังหลายแห่ง เส้นทางระหว่างคลังมีค่าน้ำมันต่างกัน (น้ำหนัก ≥ 0)
หาต้นทุนต่ำสุดจากคลัง `0` ไปยังทุกคลัง

### Input / Output

```
n = 4
edges = [(0,1,4), (0,2,1), (2,1,2), (1,3,1), (2,3,5)] # undirected
Output distances from 0: {0:0, 2:1, 1:3, 3:4}
```

---

### Naive — Bellman-style relax ทุก edge ซ้ำๆ / DFS ทุก path

ได้คำตอบบนกราฟเล็ก แต่ช้าและจัดการยากเมื่อมีหลาย path

---

### Optimized — Dijkstra + Min-Heap

```python
import heapq
from collections import defaultdict

def shortest_costs(n: int, edges: list[tuple[int,int,int]], source: int = 0) -> dict[int, float]:
    g = defaultdict(list)
    for u, v, w in edges:
        g[u].append((v, w))
        g[v].append((u, w))
    for i in range(n):
        _ = g[i]

    dist = {i: float("inf") for i in range(n)}
    dist[source] = 0.0
    heap = [(0.0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in g[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist
```

- **Time:** O((V+E) log V)
- **Space:** O(V + E)

**Edge case:** node ที่ไปไม่ถึง → dist = ∞; ห้ามใช้ถ้ามี negative weight

ดู implementation เต็ม: [`src/dijkstra.py`](./src/dijkstra.py)

---

## LAB 2: งบประมาณเน็ตเวิร์กต่ำสุด (MST — Kruskal)

### สถานการณ์

เชื่อม server ทุกเครื่องใน datacenter ด้วยสายเคเบิล ต้นทุนรวมต่ำสุด โดยทุกเครื่องต้องเชื่อมถึงกันได้

### Input / Output

```
n = 4
edges = [(0,1,10),(0,2,6),(0,3,5),(1,3,15),(2,3,4)]
Output total = 19 # เช่น (2,3,4)+(0,3,5)+(0,1,10)
```

---

### วิธีคิดทีละสเต็ป

1. Sort edges ตามน้ำหนัก
2. ใช้ Union-Find: เพิ่ม edge ถ้าสองปลายอยู่คนละเซต
3. หยุดเมื่อได้ n−1 edges

```python
# ใช้ UnionFind + kruskal จาก src/mst.py
total, mst_edges = kruskal(4, edges)
```

- **Time:** O(E log E)
- **ตรวจ:** ถ้าได้ edges น้อยกว่า n−1 → กราฟไม่เชื่อม

---

## LAB 3: ลำดับเรียนคอร์ส (Topological Sort)

### สถานการณ์

platform เรียนออนไลน์: คอร์สบางตัวต้องเรียน prerequisite ก่อน
หาลำดับเรียนที่ valid หรือบอกว่าเป็นไปไม่ได้ (มี cycle)

### Input / Output

```
num_courses = 4
prerequisites = [(1,0),(2,0),(3,1),(3,2)] # (course, prereq)
Output: เช่น [0,1,2,3] หรือ [0,2,1,3]
```

---

### Naive

ลอง permutations ทุกอันแล้วเช็ค constraints → O(n!)

---

### Optimized — Kahn's Algorithm

```python
from collections import defaultdict, deque

def find_order(num_courses: int, prerequisites: list[tuple[int,int]]) -> list[int] | None:
    adj = defaultdict(list)
    indeg = [0] * num_courses
    for course, pre in prerequisites:
        adj[pre].append(course)
        indeg[course] += 1

    q = deque([i for i in range(num_courses) if indeg[i] == 0])
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == num_courses else None
```

- **Time/Space:** O(V + E)

---

## LAB 4: จัดของลงเป้ส่งด่วน (0/1 Knapsack DP)

### สถานการณ์

พัสดุแต่ละชิ้นมีน้ำหนักและมูลค่า รถจุได้ `W` — เลือกชุดที่มูลค่ารวมสูงสุด (เอาทั้งชิ้นหรือไม่เอา)

### Input / Output

```
weights = [2,3,4,5], values = [3,4,5,6], W = 5
Output: 7 # เช่น ของหนัก 2+3 มูลค่า 3+4
```

---

### Naive — ลองทุก subset O(2ⁿ)

```python
def knapsack_naive(weights, values, W, i=0):
    if i == len(weights):
        return 0
    skip = knapsack_naive(weights, values, W, i + 1)
    take = 0
    if weights[i] <= W:
        take = values[i] + knapsack_naive(weights, values, W - weights[i], i + 1)
    return max(skip, take)
```

---

### Optimized — DP Tabulation O(nW)

```python
def knapsack(weights, values, W):
    dp = [0] * (W + 1)
    for w, v in zip(weights, values):
        for c in range(W, w - 1, -1):
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[W]
```

**ทำไมวนจากหลังมาหน้า?** เพื่อไม่ให้ใช้ชิ้นเดียวกันซ้ำในรอบเดียว (ต่างจาก unbounded knapsack)

---

## LAB 5: หน้าต่างข้อความที่สั้นที่สุด (Sliding Window Hard)

### สถานการณ์

หา substring สั้นสุดใน `s` ที่ครอบคลุมทุกตัวอักษรของ `t`

### Input / Output

```
s = "ADOBECODEBANC", t = "ABC"
Output: "BANC"
```

---

### Naive O(|s|² · |t|)

ลองทุกคู่ (left, right) แล้วเช็คว่า window ครอบคลุม t

---

### Optimized O(|s| + |t|)

1. นับความถี่ที่ต้องการใน `t`
2. ขยาย `right` จนครบ
3. หด `left` ขณะที่ยังครบ เก็บความยาวดีสุด

ดูโค้ดเต็ม: [`src/sliding_window.py`](./src/sliding_window.py) → `min_window_substring`

---

## LAB 6: ตรวจ Cycle ใน Linked List ของ Session (Floyd)

### สถานการณ์

Session token chain อาจถูกมัดผิดจนเกิด loop — ตรวจว่ามี cycle หรือไม่ด้วย memory พิเศษ O(1)

### Naive O(n) space

เก็บ seen nodes ใน Hash Set

### Optimized O(1) space — Floyd

```python
def has_cycle(head) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

**ขยาย:** หาปาก cycle ด้วย `detect_cycle_start` ใน [`src/floyd_cycle.py`](./src/floyd_cycle.py)

---

## LAB 7: สร้างทุกชุดโปรโมชัน (Backtracking Subsets)

### สถานการณ์

มีสินค้า `n` ชิ้น ต้องการทุก combo ที่ลูกค้าอาจใส่ในตะกร้า (รวมตะกร้าว่าง)

### Input / Output

```
nums = [1,2,3]
Output: [[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]
```

---

### วิธีคิด

Backtracking: ที่แต่ละขั้น เลือก "เอา / ไม่เอา" หรือ iterate เพิ่มทีละตัวแล้ว undo

```python
def subsets(nums):
    res = []
    def bt(start, path):
        res.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            bt(i + 1, path)
            path.pop()
    bt(0, [])
    return res
```

- **Time:** O(n · 2ⁿ) — ต้อง enumerate ทั้งหมดอยู่แล้ว

---

## LAB 8: Top-K สินค้าขายดี (Heap)

### สถานการณ์

จาก log การขายขนาดใหญ่ หา `k` สินค้าที่ขายดีที่สุดโดยไม่ sort ทั้งก้อน

### Input / Output

```
nums = [1,1,1,2,2,3], k = 2
Output: [1,2]
```

---

### Naive O(n log n)

นับความถี่แล้ว sort

### Optimized O(n log k)

```python
from collections import Counter
import heapq

def top_k_frequent(nums, k):
    freq = Counter(nums)
    return [x for x, _ in heapq.nlargest(k, freq.items(), key=lambda kv: kv[1])]
```

เมื่อ k ≪ n จะดีกว่า full sort ชัดเจน

---

## LAB 9: Performance & Edge Case Drill

ตอบคำถามเหล่านี้ให้ได้ก่อนสัมภาษณ์:

1. ทำไม `mid = (low+high)//2` อาจพังในภาษา 32-bit แต่ `low + (high-low)//2` ปลอดภัยกว่า?
2. Empty array / single element / all duplicates — algorithm ของคุณพังตรงไหน?
3. DP ใช้ space O(n·W) ลดเหลือ O(W) ได้อย่างไร?
4. เมื่อไหร่ Hash Map แพ้ Array / เมื่อไหร่ Heap แพ้ Quickselect?

เฉลยแนวคิดอยู่ใน [`src/performance.py`](./src/performance.py) และ README ส่วน Performance Hardening

---

## Final Checklist — Zero to Expert

- [ ] Dijkstra / MST / Topo Sort อธิบายและเขียนได้
- [ ] แปลงโจทย์เป็น DP state + recurrence ได้
- [ ] Sliding Window, Floyd, Backtracking, Top-K จำ template ได้
- [ ] พูด Naive → Optimized → Complexity ใน 2–3 นาทีได้ทุกข้อ
- [ ] มี checklist edge cases เป็นนิสัย

กลับไปทบทวน: [`../01-beginner/`](../01-beginner/) · [`../02-intermediate/`](../02-intermediate/) · [`../README.md`](../README.md)
