/**
 * Domain layer — Value Objects
 *
 * Dependency Rule: this file imports NOTHING from application/infrastructure/interface.
 * Value Objects are immutable, compared by value (not identity), and self-validating.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Money is always represented in the smallest currency unit (e.g. cents/satang) to avoid float errors. */
export class Money {
  private constructor(
    private readonly amountMinorUnits: number,
    private readonly currency: string,
  ) {}

  static of(amountMinorUnits: number, currency: string): Money {
    if (!Number.isInteger(amountMinorUnits)) {
      throw new DomainError('Money amount must be an integer of minor units (no floats)');
    }
    if (amountMinorUnits < 0) {
      throw new DomainError('Money amount cannot be negative');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainError(`Invalid ISO-4217 currency code: ${currency}`);
    }
    return new Money(amountMinorUnits, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinorUnits + other.amountMinorUnits, this.currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) throw new DomainError('Cannot multiply Money by a negative factor');
    return Money.of(Math.round(this.amountMinorUnits * factor), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinorUnits > other.amountMinorUnits;
  }

  equals(other: Money): boolean {
    return this.amountMinorUnits === other.amountMinorUnits && this.currency === other.currency;
  }

  get minorUnits(): number {
    return this.amountMinorUnits;
  }

  get isoCurrency(): string {
    return this.currency;
  }

  toDecimalString(): string {
    return (this.amountMinorUnits / 100).toFixed(2);
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

/** Quantity: a positive, bounded integer — invalid states are unrepresentable once constructed. */
export class Quantity {
  private static readonly MAX_PER_LINE = 999;

  private constructor(private readonly value: number) {}

  static of(value: number): Quantity {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainError('Quantity must be a positive integer');
    }
    if (value > Quantity.MAX_PER_LINE) {
      throw new DomainError(`Quantity exceeds max per order line (${Quantity.MAX_PER_LINE})`);
    }
    return new Quantity(value);
  }

  get raw(): number {
    return this.value;
  }

  toString(): string {
    return String(this.value);
  }
}

/** Lightweight branded identifiers — prevents mixing up an OrderId with a ProductId at compile time. */
class Identifier<TBrand extends string> {
  protected constructor(
    protected readonly value: string,
    private readonly _brand: TBrand,
  ) {}

  equals(other: Identifier<TBrand>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class OrderId extends Identifier<'OrderId'> {
  static create(value: string): OrderId {
    if (!value) throw new DomainError('OrderId cannot be empty');
    return new OrderId(value, 'OrderId');
  }
}

export class CustomerId extends Identifier<'CustomerId'> {
  static create(value: string): CustomerId {
    if (!value) throw new DomainError('CustomerId cannot be empty');
    return new CustomerId(value, 'CustomerId');
  }
}

export class ProductId extends Identifier<'ProductId'> {
  static create(value: string): ProductId {
    if (!value) throw new DomainError('ProductId cannot be empty');
    return new ProductId(value, 'ProductId');
  }
}
