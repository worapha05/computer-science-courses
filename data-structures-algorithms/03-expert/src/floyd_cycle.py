"""
Fast & Slow Pointers — Floyd's Cycle Detection
รัน: python3 floyd_cycle.py
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ListNode:
    val: int
    next: ListNode | None = None


def has_cycle(head: ListNode | None) -> bool:
    """
    Floyd: slow เดิน 1, fast เดิน 2
    Time O(n), Space O(1)
    """
    slow = fast = head
    while fast and fast.next:
        assert slow is not None
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False


def detect_cycle_start(head: ListNode | None) -> ListNode | None:
    """
    หา node ที่เป็นปาก cycle
    หลัง slow/fast เจอกัน: ตั้งตัวหนึ่งกลับไป head แล้วเดินทีละ 1 พร้อมกัน
    """
    slow = fast = head
    while fast and fast.next:
        assert slow is not None
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            break
    else:
        return None  # no cycle

    slow = head
    while slow is not fast:
        assert slow is not None and fast is not None
        slow = slow.next
        fast = fast.next
    return slow


def find_middle(head: ListNode | None) -> ListNode | None:
    """หา middle node — ถ้าคู่จำนวน คืนตัวหลังของคู่กลาง"""
    slow = fast = head
    while fast and fast.next:
        assert slow is not None
        slow = slow.next
        fast = fast.next.next
    return slow


def build_list(values: list[int], cycle_to_index: int | None = None) -> ListNode | None:
    """สร้าง list และ optionally เชื่อมท้ายกลับไปยัง index ที่กำหนด"""
    if not values:
        return None
    nodes = [ListNode(v) for v in values]
    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i + 1]
    if cycle_to_index is not None:
        nodes[-1].next = nodes[cycle_to_index]
    return nodes[0]


if __name__ == "__main__":
    no_cycle = build_list([1, 2, 3, 4, 5])
    print("has_cycle (no):", has_cycle(no_cycle))
    print("middle:", find_middle(no_cycle).val if find_middle(no_cycle) else None)

    cycled = build_list([3, 2, 0, -4], cycle_to_index=1)  # ท้ายชี้กลับไป 2
    print("has_cycle (yes):", has_cycle(cycled))
    start = detect_cycle_start(cycled)
    print("cycle starts at:", start.val if start else None)
