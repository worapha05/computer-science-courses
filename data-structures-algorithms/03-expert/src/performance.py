"""
Performance Hardening & Edge Case Patterns
รัน: python3 performance.py
"""

from __future__ import annotations


def safe_mid(low: int, high: int) -> int:
    """
    กัน overflow ในภาษาที่ int มีขอบเขตจำกัด
    (ใน Python ไม่ overflow แต่ควรติดนิสัยนี้สำหรับ interview ข้ามภาษา)
    """
    return low + (high - low) // 2


def sum_large_range(n: int) -> int:
    """
    ตัวอย่าง: อย่าใช้ loop เมื่อมีสูตรปิด
    O(1) แทน O(n)
    """
    return n * (n + 1) // 2


def dp_fib_space_optimized(n: int) -> int:
    """
    Fibonacci เก็บแค่ 2 state ล่าสุด — Space O(1) แทน O(n)
    """
    if n <= 1:
        return n
    prev2, prev1 = 0, 1
    for _ in range(2, n + 1):
        prev2, prev1 = prev1, prev2 + prev1
    return prev1


def handle_edge_cases_demo(arr: list[int] | None, target: int) -> int:
    """
    Template การกัน edge cases ก่อนเข้า logic หลัก
    """
    if arr is None or len(arr) == 0:
        return -1
    if len(arr) == 1:
        return 0 if arr[0] == target else -1

    # ตัวอย่าง logic: linear search
    for i, v in enumerate(arr):
        if v == target:
            return i
    return -1


def streaming_max(iterable) -> int | None:
    """
    ประมวลผลแบบ streaming — ไม่โหลดทั้งหมดลง memory
    เหมาะกับข้อมูลขนาดใหญ่ / file / network
    """
    iterator = iter(iterable)
    try:
        best = next(iterator)
    except StopIteration:
        return None
    for value in iterator:
        if value > best:
            best = value
    return best


def avoid_quadratic_string_concat(parts: list[str]) -> str:
    """
    ในบางภาษา string concat ใน loop เป็น O(n²)
    ใช้ join / StringBuilder แทน
    """
    return "".join(parts)


def clamp_int_add(a: int, b: int, lo: int, hi: int) -> int:
    """
    จำลองการกัน overflow ด้วยการ clamp ผลลัพธ์ให้อยู่ในช่วง
    (เช่น โจทย์ที่ระบุ 32-bit signed range)
    """
    total = a + b
    if total > hi:
        return hi
    if total < lo:
        return lo
    return total


INT32_MIN = -(2**31)
INT32_MAX = 2**31 - 1


if __name__ == "__main__":
    print("safe_mid:", safe_mid(2**30, 2**30 + 10))
    print("sum 1..100:", sum_large_range(100))
    print("fib(20):", dp_fib_space_optimized(20))
    print("edge empty:", handle_edge_cases_demo([], 1))
    print("edge none:", handle_edge_cases_demo(None, 1))
    print("streaming max:", streaming_max(range(1_000_000)))
    print("join:", avoid_quadratic_string_concat(["a", "b", "c"]))
    print("clamp:", clamp_int_add(INT32_MAX, 1, INT32_MIN, INT32_MAX))
