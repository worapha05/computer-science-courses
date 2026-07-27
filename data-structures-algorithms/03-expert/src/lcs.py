"""
Longest Common Subsequence (LCS)
รัน: python3 lcs.py
"""

from __future__ import annotations


def lcs_length(a: str, b: str) -> int:
    """
    Tabulation — O(m·n) time, O(m·n) space
    """
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]


def lcs_string(a: str, b: str) -> str:
    """สร้าง LCS string จริงด้วยการ backtrack ตาราง"""
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # reconstruct
    i, j = m, n
    chars: list[str] = []
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            chars.append(a[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    chars.reverse()
    return "".join(chars)


def lcs_length_space_optimized(a: str, b: str) -> int:
    """Space O(min(m,n)) — เก็บแค่แถวก่อนหน้า"""
    if len(a) < len(b):
        a, b = b, a
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        curr = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev = curr
    return prev[len(b)]


if __name__ == "__main__":
    a, b = "ABCBDAB", "BDCAB"
    print("length:", lcs_length(a, b))
    print("string:", lcs_string(a, b))
    print("optimized length:", lcs_length_space_optimized(a, b))
