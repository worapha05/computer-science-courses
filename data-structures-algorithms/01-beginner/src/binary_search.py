"""
Binary Search และ variants ที่พบบ่อยใน interview
รัน: python3 binary_search.py
"""

from __future__ import annotations


def binary_search(arr: list[int], target: int) -> int:
    """
    คืน index ของ target หรือ -1 ถ้าไม่พบ
    Time: O(log n)  Space: O(1)
    """
    low, high = 0, len(arr) - 1
    while low <= high:
        # ใช้ low + (high - low) // 2 กัน overflow ในภาษาที่ int มีขอบเขต
        mid = low + (high - low) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1


def lower_bound(arr: list[int], target: int) -> int:
    """
    First index ที่ arr[i] >= target (insertion point)
    ถ้าทุกตัว < target คืน len(arr)
    """
    low, high = 0, len(arr)
    while low < high:
        mid = low + (high - low) // 2
        if arr[mid] < target:
            low = mid + 1
        else:
            high = mid
    return low


def upper_bound(arr: list[int], target: int) -> int:
    """First index ที่ arr[i] > target"""
    low, high = 0, len(arr)
    while low < high:
        mid = low + (high - low) // 2
        if arr[mid] <= target:
            low = mid + 1
        else:
            high = mid
    return low


def first_and_last_occurrence(arr: list[int], target: int) -> tuple[int, int]:
    """
    หา first และ last index ของ target ใน sorted array ที่มี duplicates
    คืน (-1, -1) ถ้าไม่พบ
    """
    left = lower_bound(arr, target)
    if left == len(arr) or arr[left] != target:
        return (-1, -1)
    right = upper_bound(arr, target) - 1
    return (left, right)


def search_rotated(arr: list[int], target: int) -> int:
    """
    Binary Search ใน rotated sorted array ที่ไม่มี duplicates
    เช่น [4,5,6,7,0,1,2]
    Time: O(log n)
    """
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if arr[mid] == target:
            return mid

        # ครึ่งซ้ายเรียงปกติ
        if arr[low] <= arr[mid]:
            if arr[low] <= target < arr[mid]:
                high = mid - 1
            else:
                low = mid + 1
        # ครึ่งขวาเรียงปกติ
        else:
            if arr[mid] < target <= arr[high]:
                low = mid + 1
            else:
                high = mid - 1
    return -1


if __name__ == "__main__":
    data = [1, 3, 5, 7, 9, 11, 13]
    print("binary_search(9):", binary_search(data, 9))
    print("binary_search(4):", binary_search(data, 4))

    dups = [1, 2, 2, 2, 3, 4, 4, 5]
    print("lower_bound(2):", lower_bound(dups, 2))
    print("upper_bound(2):", upper_bound(dups, 2))
    print("first_and_last(2):", first_and_last_occurrence(dups, 2))

    rotated = [4, 5, 6, 7, 0, 1, 2]
    print("search_rotated(0):", search_rotated(rotated, 0))
    print("search_rotated(3):", search_rotated(rotated, 3))
