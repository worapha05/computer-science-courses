"""
Two Pointers Technique
รัน: python3 two_pointers.py
"""

from __future__ import annotations


def two_sum_sorted(arr: list[int], target: int) -> tuple[int, int] | None:
    """
    หาคู่ index ที่ผลรวม = target ใน sorted array
    Time: O(n)  Space: O(1)
    """
    left, right = 0, len(arr) - 1
    while left < right:
        current = arr[left] + arr[right]
        if current == target:
            return (left, right)
        if current < target:
            left += 1
        else:
            right -= 1
    return None


def is_palindrome(s: str) -> bool:
    """
    ตรวจว่าเป็น palindrome โดยมองเฉพาะตัวอักษร/ตัวเลข (ไม่สนใจ case)
    Time: O(n)  Space: O(1)
    """
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True


def remove_duplicates_sorted(arr: list[int]) -> int:
    """
    ลบ duplicates ใน sorted array in-place
    คืนค่าความยาวใหม่หลัง compact
    Time: O(n)  Space: O(1)
    Pattern: same-direction two pointers (slow/fast)
    """
    if not arr:
        return 0
    slow = 0
    for fast in range(1, len(arr)):
        if arr[fast] != arr[slow]:
            slow += 1
            arr[slow] = arr[fast]
    return slow + 1


def move_zeros(arr: list[int]) -> None:
    """
    ย้าย 0 ทั้งหมดไปท้าย array โดยรักษาลำดับตัวที่ไม่ใช่ 0
    Time: O(n)  Space: O(1)
    """
    write = 0
    for read in range(len(arr)):
        if arr[read] != 0:
            arr[write], arr[read] = arr[read], arr[write]
            write += 1


if __name__ == "__main__":
    nums = [1, 2, 4, 6, 8, 11]
    print("two_sum_sorted(10):", two_sum_sorted(nums, 10))
    print("is_palindrome('A man, a plan, a canal: Panama'):",
          is_palindrome("A man, a plan, a canal: Panama"))

    dups = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]
    new_len = remove_duplicates_sorted(dups)
    print("after remove_duplicates:", dups[:new_len])

    zeros = [0, 1, 0, 3, 12]
    move_zeros(zeros)
    print("after move_zeros:", zeros)
