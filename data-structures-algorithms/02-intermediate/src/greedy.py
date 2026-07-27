"""
Greedy Algorithms — classic examples
รัน: python3 greedy.py
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Activity:
    name: str
    start: int
    finish: int


def activity_selection(activities: list[Activity]) -> list[Activity]:
    """
    เลือกกิจกรรมที่ไม่ทับกันให้ได้มากที่สุด
    Greedy: เรียงตาม finish time แล้วเลือกอันที่เริ่มหลังอันก่อนหน้าจบ
    Time: O(n log n) จาก sort
    """
    sorted_acts = sorted(activities, key=lambda a: a.finish)
    chosen: list[Activity] = []
    last_finish = float("-inf")
    for act in sorted_acts:
        if act.start >= last_finish:
            chosen.append(act)
            last_finish = act.finish
    return chosen


def fractional_knapsack(
    weights: list[float], values: list[float], capacity: float
) -> float:
    """
    Fractional Knapsack — ตัดของได้เป็นเศษส่วน
    Greedy ตาม value/weight สูงสุดก่อน
    Time: O(n log n)
    """
    items = sorted(
        zip(weights, values),
        key=lambda wv: wv[1] / wv[0],
        reverse=True,
    )
    total_value = 0.0
    remaining = capacity
    for w, v in items:
        if remaining <= 0:
            break
        take = min(w, remaining)
        total_value += v * (take / w)
        remaining -= take
    return total_value


def coin_change_greedy(amount: int, coins: list[int]) -> list[int] | None:
    """
    Greedy coin change — ใช้ได้เมื่อระบบเหรียญเป็น canonical (เช่น [1,5,10,25])
    คืน list ของเหรียญที่ใช้ หรือ None ถ้ายอดไม่ได้
    ระวัง: กับเหรียญบางชุด greedy จะผิด! (ดูตัวอย่างใน __main__)
    """
    coins_sorted = sorted(coins, reverse=True)
    result: list[int] = []
    for c in coins_sorted:
        while amount >= c:
            result.append(c)
            amount -= c
    return result if amount == 0 else None


if __name__ == "__main__":
    acts = [
        Activity("A", 1, 4),
        Activity("B", 3, 5),
        Activity("C", 0, 6),
        Activity("D", 5, 7),
        Activity("E", 8, 9),
        Activity("F", 5, 9),
    ]
    chosen = activity_selection(acts)
    print("activities:", [a.name for a in chosen])

    print("fractional knapsack:", fractional_knapsack([10, 20, 30], [60, 100, 120], 50))

    print("US coins greedy:", coin_change_greedy(63, [1, 5, 10, 25]))
    # ตัวอย่างที่ greedy พลาด: coins=[1,3,4], amount=6
    # greedy → 4+1+1 (3 เหรียญ), optimal → 3+3 (2 เหรียญ)
    print("non-canonical greedy (may be suboptimal):", coin_change_greedy(6, [1, 3, 4]))
