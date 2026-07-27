"""
Dijkstra's Shortest Path Algorithm
รัน: python3 dijkstra.py
"""

from __future__ import annotations

import heapq
from collections import defaultdict


def dijkstra(
    graph: dict[int, list[tuple[int, int]]], source: int
) -> dict[int, float]:
    """
    graph: adjacency list ของ (neighbor, weight), weight >= 0
    คืน dict ของระยะทางสั้นสุดจาก source
    Time: O((V + E) log V) ด้วย binary heap
    """
    dist: dict[int, float] = {node: float("inf") for node in graph}
    dist[source] = 0.0
    heap: list[tuple[float, int]] = [(0.0, source)]  # (distance, node)

    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue  # stale entry
        for v, weight in graph[u]:
            nd = d + weight
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def dijkstra_with_path(
    graph: dict[int, list[tuple[int, int]]], source: int, target: int
) -> tuple[float, list[int]]:
    """คืน (ระยะทาง, path) จาก source → target"""
    dist: dict[int, float] = {node: float("inf") for node in graph}
    parent: dict[int, int | None] = {node: None for node in graph}
    dist[source] = 0.0
    heap: list[tuple[float, int]] = [(0.0, source)]

    while heap:
        d, u = heapq.heappop(heap)
        if u == target:
            break
        if d > dist[u]:
            continue
        for v, weight in graph[u]:
            nd = d + weight
            if nd < dist[v]:
                dist[v] = nd
                parent[v] = u
                heapq.heappush(heap, (nd, v))

    if dist[target] == float("inf"):
        return float("inf"), []

    path: list[int] = []
    cur: int | None = target
    while cur is not None:
        path.append(cur)
        cur = parent[cur]
    path.reverse()
    return dist[target], path


def build_undirected(edges: list[tuple[int, int, int]]) -> dict[int, list[tuple[int, int]]]:
    g: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for u, v, w in edges:
        g[u].append((v, w))
        g[v].append((u, w))
    return g


if __name__ == "__main__":
    edges = [
        (0, 1, 4),
        (0, 2, 1),
        (2, 1, 2),
        (1, 3, 1),
        (2, 3, 5),
    ]
    g = build_undirected(edges)
    print("distances from 0:", dijkstra(g, 0))
    dist, path = dijkstra_with_path(g, 0, 3)
    print(f"path 0→3: {path} cost={dist}")
