"""
Stack (LIFO) — implement จากศูนย์ด้วย list
รัน: python3 stack.py
"""

from __future__ import annotations

from typing import Generic, TypeVar

T = TypeVar("T")


class Stack(Generic[T]):
    """Last In, First Out — ทุก operation เป็น O(1)"""

    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, value: T) -> None:
        self._items.append(value)

    def pop(self) -> T:
        if self.is_empty():
            raise IndexError("pop from empty stack")
        return self._items.pop()

    def peek(self) -> T:
        if self.is_empty():
            raise IndexError("peek from empty stack")
        return self._items[-1]

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def __len__(self) -> int:
        return len(self._items)

    def __repr__(self) -> str:
        return f"Stack(top → {list(reversed(self._items))})"


def is_balanced(expression: str) -> bool:
    """
    ตรวจวงเล็บสมดุลด้วย Stack — classic interview problem
    Time: O(n)  Space: O(n)
    """
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: Stack[str] = Stack()

    for char in expression:
        if char in "([{":
            stack.push(char)
        elif char in ")]}":
            if stack.is_empty() or stack.pop() != pairs[char]:
                return False
    return stack.is_empty()


if __name__ == "__main__":
    s: Stack[int] = Stack()
    for x in [1, 2, 3]:
        s.push(x)
    print(s)
    print("peek:", s.peek())
    print("pop:", s.pop())
    print(s)

    tests = ["()", "()[]{}", "(]", "([)]", "{[]}"]
    for t in tests:
        print(f"  is_balanced({t!r}) = {is_balanced(t)}")
