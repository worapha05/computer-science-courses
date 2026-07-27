"""
Basic Sorting: Bubble, Selection, Insertion
รัน: python3 sorting.py
"""

from __future__ import annotations


def bubble_sort(arr: list[int]) -> list[int]:
    """
    สลับคู่ติดกันซ้ำๆ จนไม่มี swap
    Best O(n) เมื่อมี early-exit, Average/Worst O(n²), Space O(1), Stable
    """
    a = arr[:]
    n = len(a)
    for i in range(n):
        swapped = False
        for j in range(0, n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break  # already sorted
    return a


def selection_sort(arr: list[int]) -> list[int]:
    """
    ในแต่ละรอบ หา min ของช่วงที่ยังไม่เรียง แล้วสลับมาตำแหน่งปัจจุบัน
    Always O(n²), Space O(1), Not stable (มาตรฐาน)
    """
    a = arr[:]
    n = len(a)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if a[j] < a[min_idx]:
                min_idx = j
        a[i], a[min_idx] = a[min_idx], a[i]
    return a


def insertion_sort(arr: list[int]) -> list[int]:
    """
    หยิบแต่ละตัวแทรกเข้าตำแหน่งที่ถูกต้องในส่วนที่เรียงแล้ว
    Best O(n), Average/Worst O(n²), Space O(1), Stable
    เหมาะกับข้อมูลเกือบเรียงหรือ n เล็ก
    """
    a = arr[:]
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a


if __name__ == "__main__":
    sample = [64, 34, 25, 12, 22, 11, 90]
    print("original:      ", sample)
    print("bubble_sort:   ", bubble_sort(sample))
    print("selection_sort:", selection_sort(sample))
    print("insertion_sort:", insertion_sort(sample))

    nearly = [1, 2, 4, 3, 5, 6]
    print("insertion on nearly-sorted:", insertion_sort(nearly))
