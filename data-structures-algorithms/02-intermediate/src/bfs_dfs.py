"""
BFS & DFS on Graphs and Trees
รัน: python3 bfs_dfs.py
"""

from __future__ import annotations

from collections import deque


def bfs(graph: dict[int, list[int]], start: int) -> list[int]:
    """
    Breadth-First Search — ใช้ Queue
    Time O(V+E), Space O(V)
    คืนลำดับการเยี่ยม node
    """
    visited: set[int] = set()
    order: list[int] = []
    queue: deque[int] = deque([start])
    visited.add(start)

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order


def bfs_shortest_path(
    graph: dict[int, list[int]], start: int, goal: int
) -> list[int] | None:
    """Shortest path ใน unweighted graph ด้วย BFS + parent pointers"""
    if start == goal:
        return [start]

    visited = {start}
    queue: deque[int] = deque([start])
    parent: dict[int, int | None] = {start: None}

    while queue:
        node = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = node
                if neighbor == goal:
                    # reconstruct path
                    path = [goal]
                    while parent[path[-1]] is not None:
                        path.append(parent[path[-1]])  # type: ignore[arg-type]
                    path.reverse()
                    return path
                queue.append(neighbor)
    return None


def dfs_recursive(
    graph: dict[int, list[int]], start: int, visited: set[int] | None = None
) -> list[int]:
    """Depth-First Search แบบ recursion"""
    if visited is None:
        visited = set()
    order: list[int] = []

    def walk(node: int) -> None:
        visited.add(node)
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                walk(neighbor)

    walk(start)
    return order


def dfs_iterative(graph: dict[int, list[int]], start: int) -> list[int]:
    """DFS ด้วย explicit Stack — หลีกเลี่ยง recursion limit"""
    visited: set[int] = set()
    order: list[int] = []
    stack: list[int] = [start]

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        # reverse เพื่อให้ได้ลำดับใกล้เคียง recursive (เยี่ยมซ้ายก่อน)
        for neighbor in reversed(graph.get(node, [])):
            if neighbor not in visited:
                stack.append(neighbor)
    return order


def has_cycle_undirected(graph: dict[int, list[int]]) -> bool:
    """Detect cycle ใน undirected graph ด้วย DFS"""
    visited: set[int] = set()

    def walk(node: int, parent: int | None) -> bool:
        visited.add(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if walk(neighbor, node):
                    return True
            elif neighbor != parent:
                return True  # เจอ edge กลับไปยัง node ที่เยี่ยมแล้วและไม่ใช่ parent
        return False

    for v in graph:
        if v not in visited:
            if walk(v, None):
                return True
    return False


if __name__ == "__main__":
    graph = {
        0: [1, 2],
        1: [0, 3, 4],
        2: [0, 5],
        3: [1],
        4: [1, 5],
        5: [2, 4],
    }
    print("BFS order:", bfs(graph, 0))
    print("DFS recursive:", dfs_recursive(graph, 0))
    print("DFS iterative:", dfs_iterative(graph, 0))
    print("shortest 0→5:", bfs_shortest_path(graph, 0, 5))
    print("has cycle:", has_cycle_undirected(graph))
