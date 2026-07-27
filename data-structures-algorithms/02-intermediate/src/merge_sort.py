"""
Merge Sort — Divide and Conquer
รัน: python3 merge_sort.py
"""

from __future__ import annotations


def merge_sort(arr: list[int]) -> list[int]:
    """
    Time: O(n log n) เสมอ
    Space: O(n)
    Stable: Yes
    """
    if len(arr) <= 1:
        return arr[:]

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return _merge(left, right)


def _merge(left: list[int], right: list[int]) -> list[int]:
    """รวมสอง sorted arrays เป็นหนึ่ง sorted array — O(n)"""
    result: list[int] = []
    i = j = 0
    while i < len(left) and j < len(right):
        # <= ทำให้ stable (ถ้าเท่ากัน เอาจากซ้ายก่อน)
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result


def merge_sort_counting_inversions(arr: list[int]) -> tuple[list[int], int]:
    """
    นับจำนวน inversions (คู่ i<j แต่ arr[i]>arr[j]) ระหว่าง merge
    ใช้ในโจทย์ "นับคู่ที่สลับลำดับ"
    """

    def sort_count(a: list[int]) -> tuple[list[int], int]:
        if len(a) <= 1:
            return a[:], 0
        mid = len(a) // 2
        left, left_inv = sort_count(a[:mid])
        right, right_inv = sort_count(a[mid:])
        merged, split_inv = merge_count(left, right)
        return merged, left_inv + right_inv + split_inv

    def merge_count(left: list[int], right: list[int]) -> tuple[list[int], int]:
        result: list[int] = []
        i = j = inv = 0
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                result.append(left[i])
                i += 1
            else:
                result.append(right[j])
                inv += len(left) - i  # ทุกตัวที่เหลือทางซ้ายเป็น inversion
                j += 1
        result.extend(left[i:])
        result.extend(right[j:])
        return result, inv

    return sort_count(arr)


if __name__ == "__main__":
    data = [38, 27, 43, 3, 9, 82, 10]
    print("sorted:", merge_sort(data))
    sorted_arr, inversions = merge_sort_counting_inversions([2, 4, 1, 3, 5])
    print("sorted with inversions:", sorted_arr, "inversions:", inversions)
