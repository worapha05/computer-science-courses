/**
 * Circuit Breaker — stops calling a dependency that is currently failing,
 * so callers fail fast instead of piling up threads/connections waiting on
 * a doomed call (which would eventually take the CALLER down too).
 *
 * State machine:
 *
 * CLOSED ──(failures >= threshold)──▶ OPEN
 *  ▲         │
 *  │      (resetTimeout elapses)
 *  │         ▼
 *  └──(success >= threshold)──── HALF_OPEN ──(any failure)──▶ OPEN
 *
 * - CLOSED  : calls pass through; failures are counted in a rolling window.
 * - OPEN  : calls are rejected immediately (no network call at all).
 * - HALF_OPEN : a limited number of "trial" calls are allowed through to
 *     test whether the dependency has recovered.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit "${name}" is OPEN — call rejected without hitting the dependency`);
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  readonly name: string;
  /** Consecutive failures in CLOSED state before the circuit opens. */
  readonly failureThreshold: number;
  /** How long to stay OPEN before allowing a trial call (HALF_OPEN). */
  readonly resetTimeoutMs: number;
  /** Consecutive successes in HALF_OPEN required to fully close the circuit. */
  readonly halfOpenSuccessThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'OPEN') {
      throw new CircuitOpenError(this.options.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.options.halfOpenSuccessThreshold) {
        this.close();
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  private onFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.open();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }

  private close(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
}
