"""
Singly & Doubly Linked Lists — implement จากศูนย์
รัน: python3 linked_list.py
"""

from __future__ import annotations

from typing import Generic, TypeVar

T = TypeVar("T")


class SinglyNode(Generic[T]):
    def __init__(self, value: T, next: SinglyNode[T] | None = None) -> None:
        self.value = value
        self.next = next


class SinglyLinkedList(Generic[T]):
    def __init__(self) -> None:
        self.head: SinglyNode[T] | None = None
        self.tail: SinglyNode[T] | None = None
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def prepend(self, value: T) -> None:
        """O(1) — แทรกที่หัว"""
        node = SinglyNode(value, self.head)
        self.head = node
        if self.tail is None:
            self.tail = node
        self._size += 1

    def append(self, value: T) -> None:
        """O(1) เพราะมี tail pointer"""
        node = SinglyNode(value)
        if self.tail is None:
            self.head = self.tail = node
        else:
            self.tail.next = node
            self.tail = node
        self._size += 1

    def find(self, value: T) -> SinglyNode[T] | None:
        """O(n)"""
        current = self.head
        while current:
            if current.value == value:
                return current
            current = current.next
        return None

    def delete(self, value: T) -> bool:
        """O(n) — ต้องหา previous node"""
        current = self.head
        prev: SinglyNode[T] | None = None
        while current:
            if current.value == value:
                if prev is None:
                    self.head = current.next
                else:
                    prev.next = current.next
                if current is self.tail:
                    self.tail = prev
                self._size -= 1
                return True
            prev = current
            current = current.next
        return False

    def to_list(self) -> list[T]:
        result: list[T] = []
        current = self.head
        while current:
            result.append(current.value)
            current = current.next
        return result

    def __repr__(self) -> str:
        return " -> ".join(str(v) for v in self.to_list()) or "(empty)"


class DoublyNode(Generic[T]):
    def __init__(
        self,
        value: T,
        prev: DoublyNode[T] | None = None,
        next: DoublyNode[T] | None = None,
    ) -> None:
        self.value = value
        self.prev = prev
        self.next = next


class DoublyLinkedList(Generic[T]):
    def __init__(self) -> None:
        self.head: DoublyNode[T] | None = None
        self.tail: DoublyNode[T] | None = None
        self._size = 0

    def __len__(self) -> int:
        return self._size

    def prepend(self, value: T) -> None:
        """O(1)"""
        node = DoublyNode(value, prev=None, next=self.head)
        if self.head:
            self.head.prev = node
        else:
            self.tail = node
        self.head = node
        self._size += 1

    def append(self, value: T) -> None:
        """O(1)"""
        node = DoublyNode(value, prev=self.tail, next=None)
        if self.tail:
            self.tail.next = node
        else:
            self.head = node
        self.tail = node
        self._size += 1

    def delete_node(self, node: DoublyNode[T]) -> None:
        """O(1) เมื่อมี reference ไปยัง node โดยตรง — ข้อได้เปรียบของ Doubly"""
        if node.prev:
            node.prev.next = node.next
        else:
            self.head = node.next
        if node.next:
            node.next.prev = node.prev
        else:
            self.tail = node.prev
        self._size -= 1

    def to_list_forward(self) -> list[T]:
        result: list[T] = []
        current = self.head
        while current:
            result.append(current.value)
            current = current.next
        return result

    def to_list_backward(self) -> list[T]:
        result: list[T] = []
        current = self.tail
        while current:
            result.append(current.value)
            current = current.prev
        return result

    def __repr__(self) -> str:
        return " ⇄ ".join(str(v) for v in self.to_list_forward()) or "(empty)"


if __name__ == "__main__":
    sll = SinglyLinkedList[int]()
    sll.append(1)
    sll.append(2)
    sll.prepend(0)
    print("Singly:", sll)
    sll.delete(1)
    print("After delete 1:", sll)

    dll = DoublyLinkedList[str]()
    dll.append("A")
    dll.append("B")
    dll.append("C")
    print("Doubly forward:", dll.to_list_forward())
    print("Doubly backward:", dll.to_list_backward())
    assert dll.head is not None and dll.head.next is not None
    dll.delete_node(dll.head.next)  # ลบ "B" ใน O(1)
    print("After delete B:", dll)
