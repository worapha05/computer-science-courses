"""
Dynamic Array — implement จากศูนย์ (คล้าย Python list แบบง่าย)
รัน: python3 array.py
"""

from __future__ import annotations


class DynamicArray:
    """Array ที่ขยายขนาดอัตโนมัติเมื่อเต็ม (amortized O(1) append)."""

    def __init__(self, capacity: int = 4) -> None:
        if capacity < 1:
            raise ValueError("capacity must be >= 1")
        self._capacity = capacity
        self._size = 0
        self._data: list[object | None] = [None] * capacity

    def __len__(self) -> int:
        return self._size

    def __getitem__(self, index: int) -> object:
        """O(1) random access"""
        if index < 0 or index >= self._size:
            raise IndexError("index out of range")
        return self._data[index]

    def __setitem__(self, index: int, value: object) -> None:
        """O(1)"""
        if index < 0 or index >= self._size:
            raise IndexError("index out of range")
        self._data[index] = value

    def append(self, value: object) -> None:
        """Amortized O(1) — ถ้าเต็มจะ resize เป็น 2x แล้ว copy"""
        if self._size == self._capacity:
            self._resize(self._capacity * 2)
        self._data[self._size] = value
        self._size += 1

    def insert(self, index: int, value: object) -> None:
        """O(n) — ต้อง shift องค์ประกอบหลัง index ไปทางขวา"""
        if index < 0 or index > self._size:
            raise IndexError("index out of range")
        if self._size == self._capacity:
            self._resize(self._capacity * 2)
        for i in range(self._size, index, -1):
            self._data[i] = self._data[i - 1]
        self._data[index] = value
        self._size += 1

    def pop(self, index: int | None = None) -> object:
        """O(1) ถ้าลบท้าย, O(n) ถ้าลบตรงกลาง/หัว (ต้อง shift)"""
        if self._size == 0:
            raise IndexError("pop from empty array")
        if index is None:
            index = self._size - 1
        if index < 0 or index >= self._size:
            raise IndexError("index out of range")

        value = self._data[index]
        for i in range(index, self._size - 1):
            self._data[i] = self._data[i + 1]
        self._data[self._size - 1] = None
        self._size -= 1
        return value  # type: ignore[return-value]

    def index_of(self, value: object) -> int:
        """O(n) linear search"""
        for i in range(self._size):
            if self._data[i] == value:
                return i
        return -1

    def _resize(self, new_capacity: int) -> None:
        """O(n) — allocate ใหม่แล้ว copy"""
        new_data: list[object | None] = [None] * new_capacity
        for i in range(self._size):
            new_data[i] = self._data[i]
        self._data = new_data
        self._capacity = new_capacity

    def to_list(self) -> list[object]:
        return [self._data[i] for i in range(self._size)]  # type: ignore[misc]

    def __repr__(self) -> str:
        return f"DynamicArray({self.to_list()})"


if __name__ == "__main__":
    arr = DynamicArray(capacity=2)
    for x in [10, 20, 30, 40]:
        arr.append(x)
        print(f"after append {x}: {arr}  capacity={arr._capacity}")

    arr.insert(1, 15)
    print("after insert 15 at 1:", arr)
    print("arr[2] =", arr[2])
    print("pop():", arr.pop())
    print("pop(0):", arr.pop(0))
    print("final:", arr)
