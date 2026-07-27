"""
Topological Sort — Kahn's Algorithm & DFS-based
รัน: python3 topological_sort.py
"""

from __future__ import annotations

from collections import defaultdict, deque


def topological_sort_kahn(num_nodes: int, edges: list[tuple[int, int]]) -> list[int] | None:
    """
    Kahn's Algorithm (BFS)
    edges: directed u → v หมายถึง u ต้องมาก่อน v
    คืนลำดับ หรือ None ถ้ามี cycle
    Time: O(V + E)
    """
    adj: dict[int, list[int]] = defaultdict(list)
    indegree = [0] * num_nodes
    for u, v in edges:
        adj[u].append(v)
        indegree[v] += 1

    queue: deque[int] = deque([i for i in range(num_nodes) if indegree[i] == 0])
    order: list[int] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for nei in adj[node]:
            indegree[nei] -= 1
            if indegree[nei] == 0:
                queue.append(nei)

    if len(order) != num_nodes:
        return None  # cycle detected
    return order


def topological_sort_dfs(num_nodes: int, edges: list[tuple[int, int]]) -> list[int] | None:
    """
    DFS post-order แล้ว reverse
    ใช้ 3-color เพื่อตรวจ cycle: 0=unvisited, 1=visiting, 2=done
    """
    adj: dict[int, list[int]] = defaultdict(list)
    for u, v in edges:
        adj[u].append(v)

    color = [0] * num_nodes
    result: list[int] = []
    cycle = False

    def dfs(u: int) -> None:
        nonlocal cycle
        if cycle:
            return
        color[u] = 1
        for v in adj[u]:
            if color[v] == 1:
                cycle = True
                return
            if color[v] == 0:
                dfs(v)
        color[u] = 2
        result.append(u)

    for i in range(num_nodes):
        if color[i] == 0:
            dfs(i)
            if cycle:
                return None

    result.reverse()
    return result


def course_order(num_courses: int, prerequisites: list[tuple[int, int]]) -> list[int] | None:
    """
    LeetCode-style: prerequisites (a, b) หมายถึงต้องเรียน b ก่อน a
    = edge b → a
    """
    edges = [(b, a) for a, b in prerequisites]
    return topological_sort_kahn(num_courses, edges)


if __name__ == "__main__":
    # 0→1, 0→2, 1→3, 2→3
    edges = [(0, 1), (0, 2), (1, 3), (2, 3)]
    print("Kahn:", topological_sort_kahn(4, edges))
    print("DFS: ", topological_sort_dfs(4, edges))

    # cycle: 0→1→0
    print("cycle Kahn:", topological_sort_kahn(2, [(0, 1), (1, 0)]))

    prereq = [(1, 0), (2, 0), (3, 1), (3, 2)]  # เรียน 0 ก่อน 1 และ 2, ฯลฯ
    print("course order:", course_order(4, prereq))
