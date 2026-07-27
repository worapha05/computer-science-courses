"""
Big O Notation — ตัวอย่าง Complexity แต่ละระดับ
รัน: python3 big_o_examples.py
"""

from __future__ import annotations


def constant_time(arr: list[int], index: int) -> int:
    """O(1) — เข้าถึงด้วย index โดยตรง ไม่ขึ้นกับขนาด array"""
    return arr[index]


def logarithmic_time(arr: list[int], target: int) -> int:
    """O(log n) — Binary Search ตัดครึ่งหนึ่งทุกครั้ง"""
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1


def linear_time(arr: list[int]) -> int:
    """O(n) — วนผ่านทุกองค์ประกอบครั้งเดียว"""
    total = 0
    for value in arr:
        total += value
    return total


def linearithmic_time(arr: list[int]) -> list[int]:
    """O(n log n) — Merge Sort แบบย่อ"""
    if len(arr) <= 1:
        return arr

    mid = len(arr) // 2
    left = linearithmic_time(arr[:mid])
    right = linearithmic_time(arr[mid:])
    return _merge(left, right)


def _merge(left: list[int], right: list[int]) -> list[int]:
    result: list[int] = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def quadratic_time(arr: list[int]) -> list[tuple[int, int]]:
    """O(n²) — เปรียบเทียบทุกคู่"""
    pairs: list[tuple[int, int]] = []
    n = len(arr)
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((arr[i], arr[j]))
    return pairs


def analyze_nested_loops(n: int) -> str:
    """
    ช่วยนับว่า nested loop ให้อะไร:
      for i in range(n):          → O(n)
          for j in range(n):      → O(n) ซ้อน → O(n²)
              for k in range(n):  → O(n) ซ้อนอีก → O(n³)
    """
    count = 0
    for i in range(n):
        for j in range(n):
            count += 1
    return f"n={n} → inner body ran {count} times ≈ O(n²)"


if __name__ == "__main__":
    data = [1, 3, 5, 7, 9, 11, 13, 15]

    print("O(1) access index 3:", constant_time(data, 3))
    print("O(log n) find 11:", logarithmic_time(data, 11))
    print("O(n) sum:", linear_time(data))
    print("O(n log n) sort:", linearithmic_time([5, 2, 8, 1, 9]))
    print("O(n²) pairs count:", len(quadratic_time([1, 2, 3, 4])))
    print(analyze_nested_loops(10))
