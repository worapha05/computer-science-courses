"""
Quick Sort — Divide and Conquer with partitioning
รัน: python3 quick_sort.py
"""

from __future__ import annotations

import random


def quick_sort(arr: list[int]) -> list[int]:
    """Wrapper ที่ไม่แก้ array ต้นฉบับ"""
    a = arr[:]
    _quick_sort_inplace(a, 0, len(a) - 1)
    return a


def _quick_sort_inplace(arr: list[int], low: int, high: int) -> None:
    """
    Average: O(n log n), Worst: O(n²)
    Space: O(log n) average call stack
    Not stable
    """
    if low >= high:
        return
    pivot_index = _partition(arr, low, high)
    _quick_sort_inplace(arr, low, pivot_index - 1)
    _quick_sort_inplace(arr, pivot_index + 1, high)


def _partition(arr: list[int], low: int, high: int) -> int:
    """
    Lomuto partition: เลือก pivot แบบสุ่มแล้วสลับไปท้าย
    เพื่อลดโอกาส worst case บนข้อมูลที่เรียงแล้ว
    """
    pivot_idx = random.randint(low, high)
    arr[pivot_idx], arr[high] = arr[high], arr[pivot_idx]
    pivot = arr[high]

    i = low
    for j in range(low, high):
        if arr[j] <= pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[high] = arr[high], arr[i]
    return i


def quickselect(arr: list[int], k: int) -> int:
    """
    หา k-th smallest (0-indexed) ใน average O(n)
    เป็นรากฐานของ Quickselect / introselect
    """
    if k < 0 or k >= len(arr):
        raise IndexError("k out of range")
    a = arr[:]

    def select(low: int, high: int, k: int) -> int:
        if low == high:
            return a[low]
        pivot_index = _partition(a, low, high)
        if k == pivot_index:
            return a[k]
        if k < pivot_index:
            return select(low, pivot_index - 1, k)
        return select(pivot_index + 1, high, k)

    return select(0, len(a) - 1, k)


if __name__ == "__main__":
    data = [10, 7, 8, 9, 1, 5, 3]
    print("quick_sort:", quick_sort(data))
    print("2nd smallest:", quickselect(data, 1))
    print("median-ish:", quickselect(data, len(data) // 2))
