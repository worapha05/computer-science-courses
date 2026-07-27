"""
Recursion Fundamentals
รัน: python3 recursion.py
"""

from __future__ import annotations


def factorial(n: int) -> int:
    """Classic recursion — ต้องมี base case"""
    if n < 0:
        raise ValueError("n must be >= 0")
    if n <= 1:  # base case
        return 1
    return n * factorial(n - 1)  # recursive case


def fibonacci_naive(n: int) -> int:
    """
    Naive fib — O(2^n) เพราะ overlapping subproblems ไม่ได้จำ
    ใช้เพื่อสอนปัญหา อย่าใช้กับ n ใหญ่
    """
    if n <= 1:
        return n
    return fibonacci_naive(n - 1) + fibonacci_naive(n - 2)


def fibonacci_memo(n: int, memo: dict[int, int] | None = None) -> int:
    """Top-down memoization — O(n) time, O(n) space"""
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fibonacci_memo(n - 1, memo) + fibonacci_memo(n - 2, memo)
    return memo[n]


def binary_search_recursive(
    arr: list[int], target: int, low: int = 0, high: int | None = None
) -> int:
    if high is None:
        high = len(arr) - 1
    if low > high:
        return -1
    mid = low + (high - low) // 2
    if arr[mid] == target:
        return mid
    if arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, high)
    return binary_search_recursive(arr, target, low, mid - 1)


def tower_of_hanoi(n: int, source: str, target: str, aux: str) -> list[str]:
    """
    ย้ายจาน n ใบจาก source → target โดยใช้ aux
    จำนวนครั้ง: 2^n - 1
    """
    moves: list[str] = []

    def move(k: int, src: str, dst: str, helper: str) -> None:
        if k == 1:
            moves.append(f"{src} → {dst}")
            return
        move(k - 1, src, helper, dst)
        moves.append(f"{src} → {dst}")
        move(k - 1, helper, dst, src)

    move(n, source, target, aux)
    return moves


if __name__ == "__main__":
    print("factorial(5):", factorial(5))
    print("fib_naive(10):", fibonacci_naive(10))
    print("fib_memo(40):", fibonacci_memo(40))
    print("binsearch:", binary_search_recursive([1, 3, 5, 7, 9], 7))
    print("hanoi(3):")
    for m in tower_of_hanoi(3, "A", "C", "B"):
        print(" ", m)
