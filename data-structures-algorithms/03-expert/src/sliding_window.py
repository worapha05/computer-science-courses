"""
Sliding Window Patterns
รัน: python3 sliding_window.py
"""

from __future__ import annotations

from collections import defaultdict


def max_sum_fixed_window(arr: list[int], k: int) -> int:
    """
    Fixed-size window: หา max sum ของ subarray ยาว k
    Time O(n), Space O(1)
    """
    if k <= 0 or k > len(arr):
        raise ValueError("invalid k")
    window_sum = sum(arr[:k])
    best = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]
        best = max(best, window_sum)
    return best


def longest_substring_without_repeating(s: str) -> int:
    """
    Variable window: ยาวสุดของ substring ที่ไม่มีตัวซ้ำ
    Time O(n), Space O(σ) เมื่อ σ = ขนาด charset
    """
    last_index: dict[str, int] = {}
    left = 0
    best = 0
    for right, ch in enumerate(s):
        if ch in last_index and last_index[ch] >= left:
            left = last_index[ch] + 1
        last_index[ch] = right
        best = max(best, right - left + 1)
    return best


def min_window_substring(s: str, t: str) -> str:
    """
    หา window สั้นสุดใน s ที่ครอบคลุมทุกตัวอักษรใน t (นับความถี่)
    Classic hard sliding window
    Time O(|s| + |t|)
    """
    if not t or not s:
        return ""

    need: dict[str, int] = defaultdict(int)
    for ch in t:
        need[ch] += 1
    missing = len(t)
    left = 0
    best_start, best_len = 0, float("inf")

    for right, ch in enumerate(s):
        if need[ch] > 0:
            missing -= 1
        need[ch] -= 1

        while missing == 0:
            if right - left + 1 < best_len:
                best_start = left
                best_len = right - left + 1
            left_ch = s[left]
            need[left_ch] += 1
            if need[left_ch] > 0:
                missing += 1
            left += 1

    return "" if best_len == float("inf") else s[best_start : best_start + best_len]


if __name__ == "__main__":
    print("max_sum_fixed:", max_sum_fixed_window([2, 1, 5, 1, 3, 2], 3))
    print("longest no repeat:", longest_substring_without_repeating("abcabcbb"))
    print("min window:", min_window_substring("ADOBECODEBANC", "ABC"))
