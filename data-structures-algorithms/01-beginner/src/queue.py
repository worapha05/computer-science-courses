"""
Queue (FIFO) และ Deque — implement จากศูนย์
รัน: python3 queue.py
"""

from __future__ import annotations

from collections import deque
from typing import Generic, TypeVar

T = TypeVar("T")


class Queue(Generic[T]):
    """
    First In, First Out
    ใช้ collections.deque เพื่อให้ enqueue/dequeue เป็น O(1)
    (list.pop(0) จะเป็น O(n) — ห้ามใช้ทำ queue ใน production)
    """

    def __init__(self) -> None:
        self._items: deque[T] = deque()

    def enqueue(self, value: T) -> None:
        """O(1) — ใส่ท้ายคิว"""
        self._items.append(value)

    def dequeue(self) -> T:
        """O(1) — เอาออกจากหัวคิว"""
        if self.is_empty():
            raise IndexError("dequeue from empty queue")
        return self._items.popleft()

    def front(self) -> T:
        if self.is_empty():
            raise IndexError("front from empty queue")
        return self._items[0]

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def __len__(self) -> int:
        return len(self._items)

    def __repr__(self) -> str:
        return f"Queue(front → {list(self._items)} ← back)"


class CircularQueue(Generic[T]):
    """
    Circular Queue บน fixed-size array
    ใช้ modular arithmetic เพื่อวน index กลับไปต้น array
    """

    def __init__(self, capacity: int) -> None:
        if capacity < 1:
            raise ValueError("capacity must be >= 1")
        self._capacity = capacity
        self._data: list[T | None] = [None] * capacity
        self._head = 0
        self._size = 0

    def enqueue(self, value: T) -> None:
        if self._size == self._capacity:
            raise OverflowError("queue is full")
        tail = (self._head + self._size) % self._capacity
        self._data[tail] = value
        self._size += 1

    def dequeue(self) -> T:
        if self._size == 0:
            raise IndexError("dequeue from empty queue")
        value = self._data[self._head]
        self._data[self._head] = None
        self._head = (self._head + 1) % self._capacity
        self._size -= 1
        return value  # type: ignore[return-value]

    def is_empty(self) -> bool:
        return self._size == 0

    def is_full(self) -> bool:
        return self._size == self._capacity

    def __len__(self) -> int:
        return self._size


if __name__ == "__main__":
    q: Queue[str] = Queue()
    for name in ["Alice", "Bob", "Carol"]:
        q.enqueue(name)
    print(q)
    print("serving:", q.dequeue())
    print(q)

    cq: CircularQueue[int] = CircularQueue(3)
    cq.enqueue(1)
    cq.enqueue(2)
    cq.enqueue(3)
    print("full?", cq.is_full())
    print("dequeue:", cq.dequeue())
    cq.enqueue(4)  # ใช้ช่องที่ว่างหลัง dequeue
    print("size after wrap:", len(cq))
