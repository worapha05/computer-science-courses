"""
Hash Table — Chaining implementation จากศูนย์
รัน: python3 hash_table.py
"""

from __future__ import annotations

from typing import Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class HashTable(Generic[K, V]):
    """
    Separate Chaining Hash Map
    Average O(1) insert/get/remove, Worst O(n) เมื่อ collision หนัก
    """

    def __init__(self, capacity: int = 8, load_factor: float = 0.75) -> None:
        self._capacity = capacity
        self._size = 0
        self._load_factor = load_factor
        self._buckets: list[list[tuple[K, V]]] = [[] for _ in range(capacity)]

    def _index(self, key: K) -> int:
        return hash(key) % self._capacity

    def put(self, key: K, value: V) -> None:
        if self._size + 1 > self._capacity * self._load_factor:
            self._rehash()

        idx = self._index(key)
        bucket = self._buckets[idx]
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)  # update
                return
        bucket.append((key, value))
        self._size += 1

    def get(self, key: K, default: V | None = None) -> V | None:
        idx = self._index(key)
        for k, v in self._buckets[idx]:
            if k == key:
                return v
        return default

    def remove(self, key: K) -> bool:
        idx = self._index(key)
        bucket = self._buckets[idx]
        for i, (k, _) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                self._size -= 1
                return True
        return False

    def __contains__(self, key: K) -> bool:
        return any(k == key for k, _ in self._buckets[self._index(key)])

    def __len__(self) -> int:
        return self._size

    def _rehash(self) -> None:
        old = self._buckets
        self._capacity *= 2
        self._buckets = [[] for _ in range(self._capacity)]
        self._size = 0
        for bucket in old:
            for k, v in bucket:
                self.put(k, v)

    def keys(self) -> list[K]:
        result: list[K] = []
        for bucket in self._buckets:
            for k, _ in bucket:
                result.append(k)
        return result


def two_sum_unsorted(nums: list[int], target: int) -> list[int]:
    """
    Classic Hash Map pattern: เก็บ complementary
    Time O(n), Space O(n)
    """
    seen: dict[int, int] = {}
    for i, num in enumerate(nums):
        need = target - num
        if need in seen:
            return [seen[need], i]
        seen[num] = i
    return []


if __name__ == "__main__":
    ht: HashTable[str, int] = HashTable(capacity=4)
    ht.put("apple", 3)
    ht.put("banana", 5)
    ht.put("apple", 10)  # update
    print("apple:", ht.get("apple"))
    print("keys:", ht.keys())
    print("len:", len(ht))

    print("two_sum:", two_sum_unsorted([2, 7, 11, 15], 9))
