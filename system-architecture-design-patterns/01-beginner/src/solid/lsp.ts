/**
 * SOLID — Liskov Substitution Principle (LSP)
 * ================================================
 * "Objects of a superclass shall be replaceable with objects of its subclasses
 * without breaking the application."
 * (ถ้า S เป็นซับไทป์ของ T แล้ว object ของ T ควรถูกแทนที่ด้วย object ของ S ได้
 * โดยไม่ทำให้พฤติกรรมของโปรแกรมเปลี่ยนไปในทางที่ผิดคาด)
 *
 * ตัวอย่าง classic 2 อัน:
 * 1) Bird / Penguin — subclass ที่ "ทำไม่ได้ตามสัญญา" ของ superclass (บินไม่ได้)
 * 2) Rectangle / Square — subclass ที่ "แก้ invariant" ของ superclass (พื้นที่เปลี่ยนพฤติกรรมไม่คาดคิด)
 */

// ===========================================================================
// (1) ❌ ANTI-PATTERN: Bird ที่สมมติว่า "นกทุกตัวบินได้"
// ===========================================================================
// ปัญหา: Penguin เป็น subtype ของ Bird แต่ไม่สามารถ fly() ได้จริง
// การ throw error หรือ no-op ใน override ถือว่า "ผิดสัญญา" ของ superclass
// -> โค้ดที่เขียนโดยอ้างอิง Bird (polymorphic) จะพังตอน runtime เมื่อได้ Penguin มา

abstract class BirdAntiPattern {
  abstract fly(): string;
}

class SparrowAntiPattern extends BirdAntiPattern {
  fly(): string {
    return 'Sparrow flies swiftly through the air';
  }
}

class PenguinAntiPattern extends BirdAntiPattern {
  // ❌ ละเมิด LSP: penguin บินไม่ได้ แต่ต้อง override เพราะ superclass บังคับ
  fly(): string {
    throw new Error("Penguins can't fly!");
  }
}

function makeBirdFlyAntiPattern(bird: BirdAntiPattern): string {
  // function นี้ทำงานถูกกับ Sparrow แต่จะ throw ถ้าได้ Penguin มา
  // -> ผิดหลัก LSP เพราะ "แทนที่ Bird ด้วย subclass แล้วพฤติกรรมพัง"
  return bird.fly();
}

// ===========================================================================
// (1) ✅ REFACTORED: แยกความสามารถ "บินได้" ออกจาก "เป็นนก"
// ===========================================================================
// แนวคิด: ใช้ interface แยกตามความสามารถ (capability-based) แทนการ inherit
// จาก base class ที่ตั้งสมมติฐานผิด ๆ ว่าทุก subclass ทำได้เหมือนกันหมด

interface Flyable {
  fly(): string;
}

interface Swimmable {
  swim(): string;
}

abstract class Bird {
  abstract describe(): string;
}

class Sparrow extends Bird implements Flyable {
  describe(): string {
    return 'Sparrow: small, agile, flies';
  }

  fly(): string {
    return 'Sparrow flies swiftly through the air';
  }
}

class Penguin extends Bird implements Swimmable {
  describe(): string {
    return 'Penguin: flightless, excellent swimmer';
  }

  swim(): string {
    return 'Penguin swims gracefully underwater';
  }
}

/** function นี้รับเฉพาะสิ่งที่ "บินได้" เท่านั้น จึงไม่มีทางได้ Penguin มาทำให้พัง */
function makeItFly(flyable: Flyable): string {
  return flyable.fly();
}

// ===========================================================================
// (2) ❌ ANTI-PATTERN: Rectangle / Square — subclass เปลี่ยน invariant ของ parent
// ===========================================================================
// ปัญหา: ทางคณิตศาสตร์ Square "เป็น" Rectangle ชนิดพิเศษ (width === height)
// แต่ในโค้ด OOP ถ้า Square inherit จาก Rectangle แล้ว override setWidth/setHeight
// ให้ปรับทั้งสองด้านพร้อมกัน จะทำให้ "invariant ที่โค้ดเรียกใช้คาดหวัง" พังไปด้วย

class RectangleAntiPattern {
  constructor(
    protected width: number,
    protected height: number,
  ) {}

  setWidth(width: number): void {
    this.width = width;
  }

  setHeight(height: number): void {
    this.height = height;
  }

  getArea(): number {
    return this.width * this.height;
  }
}

class SquareAntiPattern extends RectangleAntiPattern {
  // ❌ ละเมิด LSP: การ set width เพียงด้านเดียว กลับไป "แก้ height ด้วย" อย่างไม่คาดคิด
  override setWidth(width: number): void {
    this.width = width;
    this.height = width;
  }

  override setHeight(height: number): void {
    this.width = height;
    this.height = height;
  }
}

/**
 * โค้ดฝั่งผู้ใช้ (client code) นี้ "คาดหวัง" ว่า setWidth จะไม่กระทบ height
 * ซึ่งเป็นสมมติฐานที่ใช้ได้กับ Rectangle แต่พังทันทีถ้า inject Square เข้ามา
 */
function resizeAndCheckAntiPattern(rect: RectangleAntiPattern): void {
  rect.setWidth(5);
  rect.setHeight(4);
  const area = rect.getArea();
  const expected = 5 * 4;
  console.log(
    `Expected area = ${expected}, Actual area = ${area} -> ${area === expected ? 'OK' : '❌ LSP VIOLATION!'}`,
  );
}

// ===========================================================================
// (2) ✅ REFACTORED: ไม่ inherit กันตรง ๆ ใช้ shape abstraction ร่วมแทน
// ===========================================================================
// แนวคิด: Rectangle และ Square เป็น "Shape" คนละชนิดที่ implement สัญญาเดียวกัน
// (getArea) แต่ไม่มีความสัมพันธ์แบบ is-a ที่ผิด invariant ต่อกัน
// ทำให้ทั้งคู่ "แทนที่กันได้อย่างปลอดภัย" ในบริบทที่ต้องการแค่ Shape

interface Shape {
  getArea(): number;
  describe(): string;
}

class Rectangle implements Shape {
  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  getArea(): number {
    return this.width * this.height;
  }

  describe(): string {
    return `Rectangle(${this.width}x${this.height})`;
  }

  /** immutable "wither" — คืนค่า Rectangle ใหม่ ไม่กลายพันธุ์ตัวเดิม */
  withWidth(width: number): Rectangle {
    return new Rectangle(width, this.height);
  }
}

class Square implements Shape {
  constructor(private readonly side: number) {}

  getArea(): number {
    return this.side * this.side;
  }

  describe(): string {
    return `Square(${this.side})`;
  }

  withSide(side: number): Square {
    return new Square(side);
  }
}

function printArea(shape: Shape): void {
  console.log(`${shape.describe()} -> area = ${shape.getArea()}`);
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- (1) ❌ Anti-pattern: Bird.fly() ---');
  console.log(makeBirdFlyAntiPattern(new SparrowAntiPattern()));
  try {
    makeBirdFlyAntiPattern(new PenguinAntiPattern());
  } catch (err) {
    console.log(`❌ LSP VIOLATION caught at runtime: ${(err as Error).message}`);
  }

  console.log('\n--- (1) ✅ Refactored: capability-based interfaces ---');
  console.log(new Sparrow().describe());
  console.log(makeItFly(new Sparrow()));
  console.log(new Penguin().describe());
  console.log(new Penguin().swim());
  console.log(
    'Note: makeItFly(penguin) ไม่สามารถ compile ได้เลย เพราะ Penguin ไม่ implement Flyable',
  );

  console.log('\n--- (2) ❌ Anti-pattern: Rectangle/Square inheritance ---');
  resizeAndCheckAntiPattern(new RectangleAntiPattern(2, 2));
  resizeAndCheckAntiPattern(new SquareAntiPattern(2, 2));

  console.log('\n--- (2) ✅ Refactored: Shape composition, no is-a hierarchy ---');
  printArea(new Rectangle(5, 4));
  printArea(new Square(4));
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  BirdAntiPattern,
  SparrowAntiPattern,
  PenguinAntiPattern,
  Sparrow,
  Penguin,
  RectangleAntiPattern,
  SquareAntiPattern,
  Rectangle,
  Square,
};
export type { Flyable, Swimmable, Shape };
