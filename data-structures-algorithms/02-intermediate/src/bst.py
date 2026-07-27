"""
Binary Search Tree (BST)
รัน: python3 bst.py
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class BSTNode:
    value: int
    left: BSTNode | None = None
    right: BSTNode | None = None


class BST:
    def __init__(self) -> None:
        self.root: BSTNode | None = None

    def insert(self, value: int) -> None:
        self.root = self._insert(self.root, value)

    def _insert(self, node: BSTNode | None, value: int) -> BSTNode:
        if node is None:
            return BSTNode(value)
        if value < node.value:
            node.left = self._insert(node.left, value)
        elif value > node.value:
            node.right = self._insert(node.right, value)
        # duplicate → ignore
        return node

    def search(self, value: int) -> bool:
        node = self.root
        while node:
            if value == node.value:
                return True
            node = node.left if value < node.value else node.right
        return False

    def inorder(self) -> list[int]:
        """In-order ของ BST = sorted ascending"""
        result: list[int] = []

        def walk(node: BSTNode | None) -> None:
            if node is None:
                return
            walk(node.left)
            result.append(node.value)
            walk(node.right)

        walk(self.root)
        return result

    def min_value(self, node: BSTNode | None = None) -> int:
        node = node if node is not None else self.root
        if node is None:
            raise ValueError("empty tree")
        while node.left:
            node = node.left
        return node.value

    def delete(self, value: int) -> None:
        self.root = self._delete(self.root, value)

    def _delete(self, node: BSTNode | None, value: int) -> BSTNode | None:
        if node is None:
            return None
        if value < node.value:
            node.left = self._delete(node.left, value)
        elif value > node.value:
            node.right = self._delete(node.right, value)
        else:
            # พบแล้ว — 3 กรณี: ไม่มีลูก / ลูกเดียว / สองลูก
            if node.left is None:
                return node.right
            if node.right is None:
                return node.left
            successor = self.min_value(node.right)
            node.value = successor
            node.right = self._delete(node.right, successor)
        return node


if __name__ == "__main__":
    tree = BST()
    for v in [50, 30, 70, 20, 40, 60, 80]:
        tree.insert(v)
    print("inorder (sorted):", tree.inorder())
    print("search 40:", tree.search(40))
    print("search 99:", tree.search(99))
    tree.delete(50)
    print("after delete 50:", tree.inorder())
