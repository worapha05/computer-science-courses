"""
Graph representations: Adjacency List & Adjacency Matrix
รัน: python3 graph.py
"""

from __future__ import annotations

from collections import defaultdict


class GraphAdjList:
    """
    Adjacency List — เหมาะกับ sparse graph
    Space: O(V + E)
    """

    def __init__(self, directed: bool = False) -> None:
        self.directed = directed
        self.adj: dict[int, list[int]] = defaultdict(list)

    def add_edge(self, u: int, v: int) -> None:
        self.adj[u].append(v)
        if not self.directed:
            self.adj[v].append(u)
        else:
            self.adj[v]  # ensure v has a key even without neighbors

    def neighbors(self, u: int) -> list[int]:
        return list(self.adj[u])

    def vertices(self) -> list[int]:
        return list(self.adj.keys())

    def has_edge(self, u: int, v: int) -> bool:
        return v in self.adj[u]


class GraphAdjMatrix:
    """
    Adjacency Matrix — เหมาะกับ dense graph / เช็ค edge บ่อย
    Space: O(V²)
    """

    def __init__(self, num_vertices: int, directed: bool = False) -> None:
        self.n = num_vertices
        self.directed = directed
        self.matrix = [[0] * num_vertices for _ in range(num_vertices)]

    def add_edge(self, u: int, v: int, weight: int = 1) -> None:
        self.matrix[u][v] = weight
        if not self.directed:
            self.matrix[v][u] = weight

    def has_edge(self, u: int, v: int) -> bool:
        return self.matrix[u][v] != 0

    def neighbors(self, u: int) -> list[int]:
        return [v for v in range(self.n) if self.matrix[u][v] != 0]


if __name__ == "__main__":
    #  Undirected: 0-1, 0-2, 1-2, 2-3
    g = GraphAdjList(directed=False)
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        g.add_edge(u, v)
    print("AdjList neighbors of 2:", g.neighbors(2))
    print("has_edge(0,3):", g.has_edge(0, 3))

    m = GraphAdjMatrix(4, directed=False)
    for u, v in [(0, 1), (0, 2), (1, 2), (2, 3)]:
        m.add_edge(u, v)
    print("AdjMatrix neighbors of 2:", m.neighbors(2))
    print("has_edge(0,1):", m.has_edge(0, 1))
