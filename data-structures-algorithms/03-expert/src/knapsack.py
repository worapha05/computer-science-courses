"""
0/1 Knapsack — Memoization & Tabulation
รัน: python3 knapsack.py
"""

from __future__ import annotations


def knapsack_memo(
    weights: list[int], values: list[int], capacity: int
) -> int:
    """Top-Down DP with memoization — O(nW) time & space"""
    n = len(weights)
    memo: dict[tuple[int, int], int] = {}

    def dp(i: int, cap: int) -> int:
        if i == n or cap == 0:
            return 0
        key = (i, cap)
        if key in memo:
            return memo[key]
        # ไม่เอาชิ้น i
        best = dp(i + 1, cap)
        # เอาชิ้น i (ถ้าใส่ได้)
        if weights[i] <= cap:
            best = max(best, values[i] + dp(i + 1, cap - weights[i]))
        memo[key] = best
        return best

    return dp(0, capacity)


def knapsack_tabulation(
    weights: list[int], values: list[int], capacity: int
) -> int:
    """
    Bottom-Up 2D table
    dp[i][c] = max value using first i items with capacity c
    """
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        w, v = weights[i - 1], values[i - 1]
        for c in range(capacity + 1):
            dp[i][c] = dp[i - 1][c]  # skip
            if w <= c:
                dp[i][c] = max(dp[i][c], dp[i - 1][c - w] + v)
    return dp[n][capacity]


def knapsack_space_optimized(
    weights: list[int], values: list[int], capacity: int
) -> int:
    """
    ใช้ 1D array — วน capacity จากมาก→น้อย เพื่อไม่ทับ state ที่ยังต้องใช้
    Space: O(W)
    """
    dp = [0] * (capacity + 1)
    for w, v in zip(weights, values):
        for c in range(capacity, w - 1, -1):
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[capacity]


if __name__ == "__main__":
    weights = [2, 3, 4, 5]
    values = [3, 4, 5, 6]
    capacity = 5
    print("memo:      ", knapsack_memo(weights, values, capacity))
    print("tabulation:", knapsack_tabulation(weights, values, capacity))
    print("optimized: ", knapsack_space_optimized(weights, values, capacity))
