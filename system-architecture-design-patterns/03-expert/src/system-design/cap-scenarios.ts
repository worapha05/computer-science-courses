/**
 * CAP Theorem — illustrative simulation.
 *
 * CAP says: when a network Partition happens between nodes that must
 * otherwise agree, you must choose between Consistency (every read sees the
 * latest write, or an error) and Availability (every request gets a
 * response, possibly stale). You cannot have both DURING the partition —
 * outside of a partition, a well-designed system gives you both.
 *
 * This file simulates a tiny 3-node key-value cluster twice:
 * - CpStore : refuses to serve requests from a minority partition
 *    (favors Consistency) — think ZooKeeper, etcd, a
 *    synchronously-replicated RDBMS primary.
 * - ApStore : always answers using local data, even when partitioned,
 *    and reconciles later (favors Availability) — think
 *    Cassandra/DynamoDB with eventual consistency, or a CDN edge
 *    cache serving stale content during an origin outage.
 *
 * In practice this is a per-operation, per-endpoint decision, not a single
 * global setting — e.g. "check balance" might be CP while "show product
 * recommendations" is AP, in the SAME system.
 */

export class UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnavailableError';
  }
}

interface ClusterNode {
  readonly id: string;
  readonly data: Map<string, string>;
  reachable: boolean;
}

function createCluster(size: number): ClusterNode[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `node-${i + 1}`,
    data: new Map(),
    reachable: true,
  }));
}

/** CP: a write/read only succeeds if a strict majority (quorum) of nodes is reachable — guarantees no stale reads. */
export class CpStore {
  private readonly nodes: ClusterNode[];

  constructor(size = 3) {
    this.nodes = createCluster(size);
  }

  partition(unreachableNodeIds: string[]): void {
    for (const node of this.nodes) {
      node.reachable = !unreachableNodeIds.includes(node.id);
    }
  }

  healPartition(): void {
    for (const node of this.nodes) node.reachable = true;
  }

  write(key: string, value: string): void {
    const quorum = this.requireQuorum('write');
    for (const node of quorum) node.data.set(key, value);
  }

  read(key: string): string | undefined {
    const quorum = this.requireQuorum('read');
    // All nodes in a healthy quorum agree — return any one's value.
    return quorum[0]?.data.get(key);
  }

  private requireQuorum(operation: string): ClusterNode[] {
    const reachable = this.nodes.filter((n) => n.reachable);
    const majority = Math.floor(this.nodes.length / 2) + 1;
    if (reachable.length < majority) {
      throw new UnavailableError(
        `CP store rejected ${operation}: only ${reachable.length}/${this.nodes.length} nodes reachable, need ${majority} for quorum`,
      );
    }
    return reachable;
  }
}

/** AP: every reachable node answers from its own local data, even if it's isolated and stale. */
export class ApStore {
  private readonly nodes: ClusterNode[];

  constructor(size = 3) {
    this.nodes = createCluster(size);
  }

  partition(unreachableNodeIds: string[]): void {
    for (const node of this.nodes) {
      node.reachable = !unreachableNodeIds.includes(node.id);
    }
  }

  healPartition(): void {
    for (const node of this.nodes) node.reachable = true;
    this.reconcile();
  }

  /**
   * Writes directly to `atNodeId` if given (a client can always reach the
   * node it is physically connected to — that node isn't "down", it's just
   * cut off from its PEERS) or broadcasts to every currently-reachable node
   * when no target is specified. This is what makes AP stores available
   * during a partition: they never require agreement with the other side.
   */
  write(key: string, value: string, atNodeId?: string): void {
    if (atNodeId) {
      const target = this.nodes.find((n) => n.id === atNodeId);
      if (!target) throw new UnavailableError(`Unknown node ${atNodeId}`);
      target.data.set(key, value);
      return;
    }
    const targets = this.nodes.filter((n) => n.reachable);
    if (targets.length === 0) {
      throw new UnavailableError('No reachable node to accept the write');
    }
    for (const node of targets) node.data.set(key, value);
  }

  read(key: string, atNodeId?: string): string | undefined {
    const source = atNodeId
      ? this.nodes.find((n) => n.id === atNodeId)
      : this.nodes.find((n) => n.reachable);
    return source?.data.get(key);
  }

  /** Last-write-wins reconciliation is the simplest strategy; production AP stores often use vector clocks/CRDTs instead. */
  private reconcile(): void {
    const merged = new Map<string, string>();
    for (const node of this.nodes) {
      for (const [key, value] of node.data) merged.set(key, value);
    }
    for (const node of this.nodes) {
      for (const [key, value] of merged) node.data.set(key, value);
    }
  }
}

export function demoCapTradeoffs(): void {
  console.log('=== CAP: same partition, two different trade-offs ===\n');

  console.log('--- CP store (favors Consistency) ---');
  const cp = new CpStore(3);
  cp.write('inventory:sku-42', '100');
  console.log(`Initial read: inventory:sku-42 = ${cp.read('inventory:sku-42')}`);

  cp.partition(['node-2', 'node-3']); // node-1 is now isolated (minority: 1 of 3)
  try {
    cp.write('inventory:sku-42', '99');
  } catch (err) {
    if (err instanceof UnavailableError)
      console.log(`Write during partition: REJECTED — ${err.message}`);
  }
  cp.healPartition();
  console.log(
    `After heal, read: inventory:sku-42 = ${cp.read('inventory:sku-42')} (never went stale/wrong)\n`,
  );

  console.log('--- AP store (favors Availability) ---');
  const ap = new ApStore(3);
  ap.write('session:user-7', 'cart={2 items}');
  console.log(`Initial read: session:user-7 = ${ap.read('session:user-7')}`);

  ap.partition(['node-2', 'node-3']); // node-1 isolated from the rest
  ap.write('session:user-7', 'cart={3 items}', 'node-1'); // accepted locally despite being cut off
  ap.write('session:user-7', 'cart={1 item, different device}', 'node-2'); // the other side accepts a conflicting write too
  console.log(`During partition, node-1 sees: ${ap.read('session:user-7', 'node-1')}`);
  console.log(
    `During partition, node-2 sees: ${ap.read('session:user-7', 'node-2')} <-- diverged, both were "available"`,
  );

  ap.healPartition();
  console.log(`After heal (last-write-wins reconcile): ${ap.read('session:user-7')}`);
  console.log(
    '\nTakeaway: AP never rejected a request, but briefly returned two different answers for the same key. ' +
      'CP never returned a wrong answer, but refused a write while partitioned.',
  );
}
