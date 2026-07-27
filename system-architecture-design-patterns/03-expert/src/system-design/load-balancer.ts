/**
 * Load balancing algorithms — simulated against a small pool of backend
 * servers with different (simulated) processing costs, to show WHY the
 * choice of algorithm matters once servers/requests are non-uniform.
 */

export interface Backend {
  readonly id: string;
  activeConnections: number;
  totalRequestsServed: number;
}

function createBackends(count: number): Backend[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `backend-${i + 1}`,
    activeConnections: 0,
    totalRequestsServed: 0,
  }));
}

export interface LoadBalancingStrategy {
  readonly name: string;
  pick(backends: readonly Backend[]): Backend;
}

/**
 * Round Robin: cycles through backends in fixed order. Simple and fair by
 * REQUEST COUNT, but blind to how long each request takes — a backend
 * stuck on a slow request still gets the next one in rotation.
 */
export class RoundRobinStrategy implements LoadBalancingStrategy {
  readonly name = 'round-robin';
  private cursor = 0;

  pick(backends: readonly Backend[]): Backend {
    const backend = backends[this.cursor % backends.length]!;
    this.cursor += 1;
    return backend;
  }
}

/**
 * Least Connections: routes to whichever backend currently has the fewest
 * in-flight requests. Adapts to uneven request durations — a backend stuck
 * on a slow request naturally receives fewer new ones. Requires the
 * balancer to track live connection counts (more state than round robin).
 */
export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  readonly name = 'least-connections';

  pick(backends: readonly Backend[]): Backend {
    return backends.reduce((best, current) =>
      current.activeConnections < best.activeConnections ? current : best,
    );
  }
}

/**
 * Weighted Round Robin: like round robin, but backends with a higher
 * `weight` (e.g. more CPU/RAM) receive proportionally more requests.
 * Useful in a heterogeneous fleet (mixed instance sizes during a rolling
 * upgrade, or canary deployments that should get 5% of traffic, not 33%).
 */
export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  readonly name = 'weighted-round-robin';
  private cursor = 0;
  private readonly expanded: string[];

  constructor(weights: Record<string, number>) {
    // Interleave (rather than concatenate) so bursts of traffic don't land
    // entirely on one backend just because it appears first in the map —
    // e.g. {a:3,b:3,c:1} becomes [a,b,c,a,b,a,b], not [a,a,a,b,b,b,c].
    const entries = Object.entries(weights);
    const maxWeight = Math.max(...entries.map(([, weight]) => weight));
    const expanded: string[] = [];
    for (let round = 0; round < maxWeight; round += 1) {
      for (const [id, weight] of entries) {
        if (weight > round) expanded.push(id);
      }
    }
    this.expanded = expanded;
  }

  pick(backends: readonly Backend[]): Backend {
    const targetId = this.expanded[this.cursor % this.expanded.length]!;
    this.cursor += 1;
    return backends.find((b) => b.id === targetId) ?? backends[0]!;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulates a request whose processing time depends on the backend (some are slower — e.g. a cold instance). */
async function simulateRequest(backend: Backend, processingTimeMs: number): Promise<void> {
  backend.activeConnections += 1;
  try {
    await delay(processingTimeMs);
    backend.totalRequestsServed += 1;
  } finally {
    backend.activeConnections -= 1;
  }
}

function summarize(backends: readonly Backend[]): string {
  return backends.map((b) => `${b.id}=${b.totalRequestsServed}`).join(', ');
}

export async function demoRoundRobinVsLeastConnections(): Promise<void> {
  console.log('=== Round Robin vs Least Connections, with one slow backend ===\n');

  // backend-2 simulates a cold/overloaded instance: every request it gets takes 5x longer.
  const processingTimeMs = (backend: Backend): number => (backend.id === 'backend-2' ? 250 : 50);

  console.log('--- Round Robin (blind to in-flight load) ---');
  {
    const backends = createBackends(3);
    const strategy = new RoundRobinStrategy();
    const inFlight: Promise<void>[] = [];
    for (let i = 0; i < 12; i += 1) {
      const backend = strategy.pick(backends);
      inFlight.push(simulateRequest(backend, processingTimeMs(backend)));
      await delay(10); // requests arrive roughly every 10ms
    }
    await Promise.all(inFlight);
    console.log(` requests served per backend: ${summarize(backends)}`);
    console.log(
      ' -> backend-2 got an equal share despite being 5x slower, becoming a bottleneck for its 1/3 of traffic.',
    );
  }

  console.log('\n--- Least Connections (adapts to the slow backend) ---');
  {
    const backends = createBackends(3);
    const strategy = new LeastConnectionsStrategy();
    const inFlight: Promise<void>[] = [];
    for (let i = 0; i < 12; i += 1) {
      const backend = strategy.pick(backends);
      inFlight.push(simulateRequest(backend, processingTimeMs(backend)));
      await delay(10);
    }
    await Promise.all(inFlight);
    console.log(` requests served per backend: ${summarize(backends)}`);
    console.log(
      ' -> backend-2 naturally received fewer requests because it stayed busy longer per request.',
    );
  }

  console.log(
    '\n--- Weighted Round Robin (canary deployment: backend-3 gets only 10% of traffic) ---',
  );
  {
    const backends = createBackends(3);
    const strategy = new WeightedRoundRobinStrategy({
      'backend-1': 9,
      'backend-2': 9,
      'backend-3': 2,
    });
    for (let i = 0; i < 20; i += 1) {
      const backend = strategy.pick(backends);
      backend.totalRequestsServed += 1;
    }
    console.log(` requests served per backend: ${summarize(backends)}`);
  }
}
