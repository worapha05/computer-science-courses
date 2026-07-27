"""
Heap / Priority Queue — Top K Patterns
รัน: python3 heap_topk.py
"""

from __future__ import annotations

import heapq
from collections import Counter


def top_k_largest(nums: list[int], k: int) -> list[int]:
    """
    ใช้ Min-Heap ขนาด k
    ถ้าเจอตัวใหญ่กว่า root → แทนที่
    Time: O(n log k), Space: O(k)
    """
    if k <= 0:
        return []
    heap: list[int] = []
    for num in nums:
        if len(heap) < k:
            heapq.heappush(heap, num)
        elif num > heap[0]:
            heapq.heapreplace(heap, num)
    return sorted(heap, reverse=True)


def top_k_frequent(nums: list[int], k: int) -> list[int]:
    """
    หา k ค่าที่ปรากฏบ่อยสุด
    Time: O(n log k)
    """
    freq = Counter(nums)
    # nsmallest บน (-count) หรือใช้ heapq.nlargest
    return [item for item, _ in heapq.nlargest(k, freq.items(), key=lambda x: x[1])]


def kth_largest(nums: list[int], k: int) -> int:
    """K-th largest element — Min-Heap ขนาด k"""
    heap = nums[:k]
    heapq.heapify(heap)
    for num in nums[k:]:
        if num > heap[0]:
            heapq.heapreplace(heap, num)
    return heap[0]


def merge_k_sorted_lists(lists: list[list[int]]) -> list[int]:
    """
    รวม k sorted lists ด้วย Min-Heap
    Time: O(N log k) เมื่อ N = จำนวนองค์ประกอบทั้งหมด
    """
    heap: list[tuple[int, int, int]] = []  # (value, list_index, element_index)
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], i, 0))

    result: list[int] = []
    while heap:
        val, li, ei = heapq.heappop(heap)
        result.append(val)
        if ei + 1 < len(lists[li]):
            heapq.heappush(heap, (lists[li][ei + 1], li, ei + 1))
    return result


if __name__ == "__main__":
    data = [3, 1, 5, 12, 2, 11, 8]
    print("top 3 largest:", top_k_largest(data, 3))
    print("3rd largest:", kth_largest(data, 3))
    print("top 2 frequent:", top_k_frequent([1, 1, 1, 2, 2, 3], 2))
    print(
        "merge k lists:",
        merge_k_sorted_lists([[1, 4, 5], [1, 3, 4], [2, 6]]),
    )
