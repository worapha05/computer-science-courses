"""
Minimum Spanning Tree — Kruskal (Union-Find) & Prim
รัน: python3 mst.py
"""

from __future__ import annotations

import heapq
from collections import defaultdict


class UnionFind:
    """Disjoint Set Union พร้อม path compression + union by rank"""

    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a: int, b: int) -> bool:
        """คืน True ถ้า merge สำเร็จ (เดิมคนละเซต)"""
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            self.parent[ra] = rb
        elif self.rank[ra] > self.rank[rb]:
            self.parent[rb] = ra
        else:
            self.parent[rb] = ra
            self.rank[ra] += 1
        return True


def kruskal(n: int, edges: list[tuple[int, int, int]]) -> tuple[int, list[tuple[int, int, int]]]:
    """
    edges: (u, v, weight), nodes 0..n-1
    คืน (total_weight, mst_edges)
    Time: O(E log E)
    """
    edges_sorted = sorted(edges, key=lambda e: e[2])
    uf = UnionFind(n)
    mst: list[tuple[int, int, int]] = []
    total = 0
    for u, v, w in edges_sorted:
        if uf.union(u, v):
            mst.append((u, v, w))
            total += w
            if len(mst) == n - 1:
                break
    return total, mst


def prim(n: int, edges: list[tuple[int, int, int]], start: int = 0) -> tuple[int, list[tuple[int, int, int]]]:
    """
    Prim ด้วย Min-Heap
    Time: O((V + E) log V)
    """
    adj: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))

    visited = [False] * n
    heap: list[tuple[int, int, int]] = []  # (weight, to, frm)
    visited[start] = True
    for to, w in adj[start]:
        heapq.heappush(heap, (w, to, start))

    mst: list[tuple[int, int, int]] = []
    total = 0

    while heap and len(mst) < n - 1:
        w, u, frm = heapq.heappop(heap)
        if visited[u]:
            continue
        visited[u] = True
        mst.append((frm, u, w))
        total += w
        for v, wt in adj[u]:
            if not visited[v]:
                heapq.heappush(heap, (wt, v, u))

    return total, mst


if __name__ == "__main__":
    n = 4
    edges = [
        (0, 1, 10),
        (0, 2, 6),
        (0, 3, 5),
        (1, 3, 15),
        (2, 3, 4),
    ]
    k_total, k_mst = kruskal(n, edges)
    p_total, p_mst = prim(n, edges)
    print("Kruskal total:", k_total, "edges:", k_mst)
    print("Prim total:   ", p_total, "edges:", p_mst)
