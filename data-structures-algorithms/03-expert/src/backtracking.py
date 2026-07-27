"""
Backtracking — Subsets, Permutations, Combinations
รัน: python3 backtracking.py
"""

from __future__ import annotations


def subsets(nums: list[int]) -> list[list[int]]:
    """
    ทุก subset ของ nums (power set)
    Time: O(n · 2^n)
    """
    result: list[list[int]] = []

    def backtrack(start: int, path: list[int]) -> None:
        result.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()  # undo

    backtrack(0, [])
    return result


def permutations(nums: list[int]) -> list[list[int]]:
    """
    ทุก permutation
    Time: O(n · n!)
    """
    result: list[list[int]] = []
    used = [False] * len(nums)

    def backtrack(path: list[int]) -> None:
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i, num in enumerate(nums):
            if used[i]:
                continue
            used[i] = True
            path.append(num)
            backtrack(path)
            path.pop()
            used[i] = False

    backtrack([])
    return result


def combinations(n: int, k: int) -> list[list[int]]:
    """เลือก k ตัวจาก 1..n"""
    result: list[list[int]] = []

    def backtrack(start: int, path: list[int]) -> None:
        if len(path) == k:
            result.append(path[:])
            return
        for i in range(start, n + 1):
            path.append(i)
            backtrack(i + 1, path)
            path.pop()

    backtrack(1, [])
    return result


def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    """
    หาทุก combination ที่ผลรวม = target (ใช้ซ้ำได้)
    Pruning: หยุดเมื่อผลรวมเกิน
    """
    candidates = sorted(candidates)
    result: list[list[int]] = []

    def backtrack(start: int, remaining: int, path: list[int]) -> None:
        if remaining == 0:
            result.append(path[:])
            return
        for i in range(start, len(candidates)):
            c = candidates[i]
            if c > remaining:
                break
            path.append(c)
            backtrack(i, remaining - c, path)  # i ไม่ใช่ i+1 → ใช้ซ้ำได้
            path.pop()

    backtrack(0, target, [])
    return result


if __name__ == "__main__":
    print("subsets([1,2,3]):", subsets([1, 2, 3]))
    print("permutations([1,2,3]):", permutations([1, 2, 3]))
    print("combinations(4,2):", combinations(4, 2))
    print("combination_sum:", combination_sum([2, 3, 6, 7], 7))
