"""
Binary Tree + Traversals
รัน: python3 binary_tree.py
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class TreeNode(Generic[T]):
    value: T
    left: TreeNode[T] | None = None
    right: TreeNode[T] | None = None


def preorder(root: TreeNode[T] | None) -> list[T]:
    """Root → Left → Right"""
    if root is None:
        return []
    return [root.value] + preorder(root.left) + preorder(root.right)


def inorder(root: TreeNode[T] | None) -> list[T]:
    """Left → Root → Right"""
    if root is None:
        return []
    return inorder(root.left) + [root.value] + inorder(root.right)


def postorder(root: TreeNode[T] | None) -> list[T]:
    """Left → Right → Root"""
    if root is None:
        return []
    return postorder(root.left) + postorder(root.right) + [root.value]


def level_order(root: TreeNode[T] | None) -> list[T]:
    """BFS — ทีละระดับ"""
    if root is None:
        return []
    result: list[T] = []
    queue: deque[TreeNode[T]] = deque([root])
    while queue:
        node = queue.popleft()
        result.append(node.value)
        if node.left:
            queue.append(node.left)
        if node.right:
            queue.append(node.right)
    return result


def max_depth(root: TreeNode[T] | None) -> int:
    """ความสูงของต้นไม้ — Post-order thinking"""
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))


def build_sample() -> TreeNode[int]:
    """
            1
           / \\
          2   3
         / \\
        4   5
    """
    return TreeNode(1, TreeNode(2, TreeNode(4), TreeNode(5)), TreeNode(3))


if __name__ == "__main__":
    root = build_sample()
    print("preorder:   ", preorder(root))
    print("inorder:    ", inorder(root))
    print("postorder:  ", postorder(root))
    print("level_order:", level_order(root))
    print("max_depth:  ", max_depth(root))
