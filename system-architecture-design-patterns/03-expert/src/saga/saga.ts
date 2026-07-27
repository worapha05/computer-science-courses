/**
 * Saga Pattern — Orchestration style.
 *
 * A saga coordinates a business transaction that spans multiple services
 * (Inventory, Payment, Shipping), each with its own local database. There is
 * no distributed transaction/2PC — instead, each step has a forward action
 * and a compensating action. If step N fails, the orchestrator runs
 * compensations for steps 1..N-1 in reverse order, giving eventual
 * consistency instead of atomicity.
 *
 * ReserveInventory ──▶ ChargePayment ──▶ CreateShipment
 *   │ (compensate)  │ (compensate)  │
 *   ▼     ▼     │
 * ReleaseInventory ◀── RefundPayment ◀───────────┘ (on any failure)
 *
 * Orchestration vs choreography:
 * - Orchestration (this file): one coordinator (SagaOrchestrator) knows the
 *  whole recipe, calls each step, and decides on compensation. Easier to
 *  reason about, test, and visualize; the coordinator is a single point
 *  of control (and a single point of failure/bottleneck if not made
 *  durable, e.g. via a workflow engine or persisted saga state machine).
 * - Choreography: each service reacts to events from the previous one and
 *  emits its own event/compensating event. No central coordinator, more
 *  decoupled, but the overall flow is implicit — spread across N services'
 *  event handlers — and harder to observe/debug ("who calls whom?").
 */

export interface SagaStep<TContext> {
  readonly name: string;
  execute(ctx: TContext): Promise<void>;
  /** Must be idempotent and safe to call even if `execute` never ran or partially ran. */
  compensate(ctx: TContext): Promise<void>;
}

export interface SagaStepOutcome {
  readonly step: string;
  readonly status: 'completed' | 'compensated' | 'skipped';
}

export interface SagaResult {
  readonly success: boolean;
  readonly failedStep?: string;
  readonly failureReason?: string;
  readonly outcomes: SagaStepOutcome[];
}

/**
 * Generic orchestrator: runs steps in order; on failure, compensates
 * every previously-completed step in reverse order (LIFO), then reports a
 * structured result instead of throwing, so the caller can decide how to
 * surface the failure (retry the whole saga, alert an operator, etc.).
 */
export class SagaOrchestrator<TContext> {
  constructor(private readonly steps: SagaStep<TContext>[]) {}

  async run(ctx: TContext): Promise<SagaResult> {
    const completed: SagaStep<TContext>[] = [];
    const outcomes: SagaStepOutcome[] = [];

    for (const step of this.steps) {
      try {
        await step.execute(ctx);
        completed.push(step);
        outcomes.push({ step: step.name, status: 'completed' });
      } catch (err) {
        const failureReason = err instanceof Error ? err.message : String(err);
        await this.compensate(completed, ctx, outcomes);
        return { success: false, failedStep: step.name, failureReason, outcomes };
      }
    }

    return { success: true, outcomes };
  }

  private async compensate(
    completedSteps: SagaStep<TContext>[],
    ctx: TContext,
    outcomes: SagaStepOutcome[],
  ): Promise<void> {
    for (const step of [...completedSteps].reverse()) {
      try {
        await step.compensate(ctx);
        outcomes.push({ step: step.name, status: 'compensated' });
      } catch (compensationError) {
        // Compensation failures are the hardest failure mode in sagas: the
        // system is now in an inconsistent state that needs an operator or
        // a dead-letter/retry queue — never silently swallow this in prod.
        console.error(
          `CRITICAL: compensation for step "${step.name}" failed — manual intervention required.`,
          compensationError,
        );
      }
    }
  }
}
