# Level 2 LAB — Intermediate Challenges

โจทย์สถานการณ์จำลองแนว LeetCode/HackerRank
ลองแก้เองก่อนดูเฉลย และเปรียบเทียบ Naive vs Optimized ทุกข้อ

---

## LAB 1: นับคู่คำที่ประกอบเป็น Anagram Group (Hash Map)

### สถานการณ์

ระบบ moderation ของแชทต้องจัดกลุ่มคำที่เป็น anagram เข้าด้วยกัน
เช่น `eat`, `tea`, `ate` อยู่กลุ่มเดียวกัน

### Input / Output

```
Input: ["eat", "tea", "tan", "ate", "nat", "bat"]
Output: [["eat","tea","ate"], ["tan","nat"], ["bat"]]
(ลำดับกลุ่ม/ลำดับในกลุ่มไม่สำคัญ)
```

---

### Naive O(n² · k log k)

เปรียบเทียบทุกคู่โดย sort ตัวอักษรของแต่ละคำ

```python
def group_anagrams_naive(words: list[str]) -> list[list[str]]:
    used = [False] * len(words)
    groups: list[list[str]] = []
    for i, w in enumerate(words):
        if used[i]:
            continue
        group = [w]
        used[i] = True
        key_i = "".join(sorted(w))
        for j in range(i + 1, len(words)):
            if not used[j] and "".join(sorted(words[j])) == key_i:
                group.append(words[j])
                used[j] = True
        groups.append(group)
    return groups
```

---

### Optimized O(n · k log k) ด้วย Hash Map

ใช้ sorted string เป็น key ของ dict

```python
from collections import defaultdict

def group_anagrams(words: list[str]) -> list[list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for w in words:
        key = "".join(sorted(w))
        groups[key].append(w)
    return list(groups.values())
```

- **Time:** O(n · k log k) เมื่อ k = ความยาวคำเฉลี่ย
- **Space:** O(n · k)

**Tip สัมภาษณ์:** ใช้ frequency tuple ของ 26 ตัวอักษรเป็น key ได้ O(n · k) แทนการ sort

---

## LAB 2: เส้นทางที่สั้นที่สุดในคลังสินค้า (BFS)

### สถานการณ์

คลังสินค้าเป็น grid: `0` = ว่าง, `1` = ชั้นวางของ
หุ่นยนต์เริ่มที่มุมซ้ายบน `(0,0)` ไปยังขวาล่าง `(m-1,n-1)` เดินได้ 4 ทิศ
หาจำนวนก้าวขั้นต่ำ (ถ้าไปไม่ได้คืน `-1`)

### Input / Output

```
grid = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
]
Output: 4  # เช่น (0,0)→(0,1)→(0,2)→(1,2)→(2,2)
```

---

### Naive — DFS ลองทุก path

ได้คำตอบแต่ช้ามาก (exponential) บน grid ใหญ่

---

### Optimized — BFS สำหรับ shortest path ใน unweighted grid

```python
from collections import deque

def shortest_path(grid: list[list[int]]) -> int:
    if not grid or grid[0][0] == 1:
        return -1
    m, n = len(grid), len(grid[0])
    if grid[m - 1][n - 1] == 1:
        return -1

    visited = {(0, 0)}
    q: deque[tuple[int, int, int]] = deque([(0, 0, 0)])  # r, c, dist

    while q:
        r, c, dist = q.popleft()
        if (r, c) == (m - 1, n - 1):
            return dist
        for dr, dc in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < m and 0 <= nc < n and grid[nr][nc] == 0 and (nr, nc) not in visited:
                visited.add((nr, nc))
                q.append((nr, nc, dist + 1))
    return -1
```

- **Time:** O(m · n)
- **Space:** O(m · n)

---

## LAB 3: ตรวจว่า Binary Tree เป็น Valid BST หรือไม่

### สถานการณ์

หลัง sync ข้อมูล catalog ต้นไม้ต้องยังเป็น BST ที่ถูกต้อง
Invariant: left subtree < node < right subtree **ทั้งหมด** (ไม่ใช่แค่ลูกตรงๆ)

### Input / Output

```
 5
 / \
1   4
   / \
  3   6
Output: False  # เพราะ 3 อยู่ฝั่งขวาของ 5 แต่ 3 < 5
```

---

### Naive ที่พบบ่อย (ผิด!)

เช็คแค่ `node.left.val < node.val < node.right.val` → ไม่พอ

---

### Optimized — ส่งช่วง (min, max) ลงไปตอน DFS

```python
@dataclass
class Node:
    val: int
    left: "Node | None" = None
    right: "Node | None" = None

def is_valid_bst(root: Node | None) -> bool:
    def valid(node: Node | None, low: float, high: float) -> bool:
        if node is None:
            return True
        if not (low < node.val < high):
            return False
        return valid(node.left, low, node.val) and valid(node.right, node.val, high)

    return valid(root, float("-inf"), float("inf"))
```

ทางเลือก: in-order แล้วเช็คว่าลำดับ ascending เคร่งครัด

- **Time:** O(n)
- **Space:** O(h)

---

## LAB 4: รวมช่วงเวลาประชุม (Merge Intervals — Sort + Greedy)

### สถานการณ์

Calendar API ส่งช่วงประชุมที่ซ้อนกันมาให้ รวมให้เป็นช่วงที่ไม่ซ้อน

### Input / Output

```
Input: [[1, 3], [2, 6], [8, 10], [15, 18]]
Output: [[1, 6], [8, 10], [15, 18]]
```

---

### Naive O(n²)

วนซ้ำ merge จนไม่มีอะไรเปลี่ยน

---

### Optimized O(n log n)

1. Sort ตาม start time
2. ไล่ทีละช่วง ถ้าซ้อนกับอันล่าสุดในผลลัพธ์ → ขยาย finish
3. ไม่ซ้อน → เพิ่มช่วงใหม่

```python
def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    if not intervals:
        return []
    intervals = sorted(intervals, key=lambda x: x[0])
    merged = [intervals[0][:]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
```

- **Time:** O(n log n)
- **Space:** O(n)

---

## LAB 5: จำนวน Islands ในแผนที่ (DFS / BFS on Grid)

### สถานการณ์

แผนที่ทะเล: `'1'` = แผ่นดิน, `'0'` = น้ำ
Island = กลุ่ม `'1'` ที่เชื่อมกันแนวตั้ง/นอน

### Input / Output

```
grid = [
    ["1", "1", "0", "0", "0"],
    ["1", "1", "0", "0", "0"],
    ["0", "0", "1", "0", "0"],
    ["0", "0", "0", "1", "1"],
]
Output: 3
```

---

### วิธีคิด

วนทุก cell ถ้าเจอ `'1'` ที่ยังไม่เยี่ยม → นับ +1 แล้ว flood-fill (DFS/BFS) ทำเครื่องหมายว่าเยี่ยมแล้ว

```python
def num_islands(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    m, n = len(grid), len(grid[0])
    count = 0

    def dfs(r: int, c: int) -> None:
        if r < 0 or c < 0 or r >= m or c >= n or grid[r][c] != "1":
            return
        grid[r][c] = "0"  # mark visited
        dfs(r + 1, c)
        dfs(r - 1, c)
        dfs(r, c + 1)
        dfs(r, c - 1)

    for i in range(m):
        for j in range(n):
            if grid[i][j] == "1":
                count += 1
                dfs(i, j)
    return count
```

- **Time:** O(m · n)
- **Space:** O(m · n) worst case call stack

---

## LAB 6: จัดตารางห้องประชุมด้วย Greedy

### สถานการณ์

มีกิจกรรมหลายอัน เลือกได้มากสุดโดยไม่ทับเวลา

ดูรายละเอียดใน [`src/greedy.py`](./src/greedy.py) — `activity_selection`

**คำถามทบทวน:** ทำไมต้อง sort ตาม **finish** ไม่ใช่ start?
คำตอบสั้นๆ: การจบเร็วเปิดโอกาสให้กิจกรรมถัดไปได้มากที่สุด (greedy choice property)

---

## Checklist ก่อนขึ้น Expert

- [ ] อธิบาย Hash collision + load factor ได้
- [ ] เขียน Tree traversals ทั้ง 4 แบบได้
- [ ] ใช้ BFS หา shortest path ใน unweighted graph/grid ได้
- [ ] แยกได้ว่าเมื่อไหร่ใช้ Greedy / เมื่อไหร่ห้ามใช้
- [ ] อธิบายความต่าง Merge Sort vs Quick Sort ได้

พร้อมแล้ว → [`../03-expert/`](../03-expert/)
