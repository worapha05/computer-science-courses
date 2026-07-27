/**
 * SOLID — Interface Segregation Principle (ISP)
 * ================================================
 * "Clients should not be forced to depend upon interfaces they do not use."
 * (ไม่ควรบังคับให้ client ต้อง implement/depend on method ที่ตัวเองไม่ได้ใช้)
 *
 * ตัวอย่างนี้จำลองระบบพนักงาน/หุ่นยนต์ในโรงงาน (Worker)
 * - ❌ ANTI-PATTERN: interface Worker "อ้วน" (fat interface) รวมทุกความสามารถไว้ที่เดียว
 * - ✅ REFACTORED: แยกเป็น interface เล็ก ๆ ตามความสามารถ (role interfaces)
 */

// ===========================================================================
// ❌ ANTI-PATTERN: Fat interface
// ===========================================================================
// ปัญหา: RobotWorker ไม่กิน ไม่นอน แต่ถูกบังคับให้ implement eat()/sleep()
// เพราะ interface เดียวรวมทุกอย่างไว้ -> ต้อง throw / no-op ซึ่งเป็นสัญญาณของ "ผิด abstraction"
// นอกจากนี้ function ที่ต้องการแค่ "ให้ทำงาน" (work) ก็ยังต้อง depend on ทั้ง interface
// ทำให้ทุกครั้งที่ fat interface เปลี่ยน (เช่น เพิ่ม attendMeeting) โค้ดที่ไม่เกี่ยวก็เสี่ยงพังไปด้วย

interface WorkerAntiPattern {
  work(): string;
  eat(): string;
  sleep(): string;
  attendMeeting(): string;
}

class HumanWorkerAntiPattern implements WorkerAntiPattern {
  work(): string {
    return 'Human is coding a feature';
  }

  eat(): string {
    return 'Human is having lunch';
  }

  sleep(): string {
    return 'Human is sleeping at night';
  }

  attendMeeting(): string {
    return 'Human is attending a stand-up meeting';
  }
}

class RobotWorkerAntiPattern implements WorkerAntiPattern {
  work(): string {
    return 'Robot is welding car frames';
  }

  // ❌ ละเมิด ISP: ถูกบังคับ implement สิ่งที่ไม่มีทางทำได้จริง
  eat(): string {
    throw new Error("Robots don't eat!");
  }

  sleep(): string {
    throw new Error("Robots don't sleep!");
  }

  attendMeeting(): string {
    throw new Error("Robots don't attend meetings!");
  }
}

// ===========================================================================
// ✅ REFACTORED: Segregated (role-based) interfaces
// ===========================================================================
// แนวคิด: แยกความสามารถออกเป็น interface เล็ก ๆ ที่มีความหมายเฉพาะตัว (single concept)
// แต่ละ class เลือก implement เฉพาะ interface ที่เกี่ยวข้องกับตัวเองจริง ๆ

interface Workable {
  work(): string;
}

interface Eatable {
  eat(): string;
}

interface Sleepable {
  sleep(): string;
}

interface MeetingAttendee {
  attendMeeting(): string;
}

/** มนุษย์ทำได้ทุกอย่าง -> implement ทุก interface ที่เกี่ยวข้อง */
class HumanWorker implements Workable, Eatable, Sleepable, MeetingAttendee {
  work(): string {
    return 'Human is coding a feature';
  }

  eat(): string {
    return 'Human is having lunch';
  }

  sleep(): string {
    return 'Human is sleeping at night';
  }

  attendMeeting(): string {
    return 'Human is attending a stand-up meeting';
  }
}

/** หุ่นยนต์ทำงานได้อย่างเดียว -> implement แค่ Workable ไม่ต้องมี eat/sleep/attendMeeting */
class RobotWorker implements Workable {
  work(): string {
    return 'Robot is welding car frames';
  }
}

/** ผู้จัดการ ไม่ได้ลงมือ "work" แบบ hands-on แต่ประชุม กิน นอนได้ */
class Manager implements Eatable, Sleepable, MeetingAttendee {
  eat(): string {
    return 'Manager is having lunch with the team';
  }

  sleep(): string {
    return 'Manager is sleeping at night';
  }

  attendMeeting(): string {
    return 'Manager is leading a planning meeting';
  }
}

/**
 * function ที่ต้องการแค่ "สั่งให้ทำงาน" ควร depend on interface เล็กที่สุดที่พอใช้ (Workable)
 * ไม่ใช่ WorkerAntiPattern (fat interface) ที่พ่วงเอา eat/sleep/attendMeeting มาด้วยโดยไม่จำเป็น
 */
function assignTask(worker: Workable): string {
  return worker.work();
}

function scheduleLunch(person: Eatable): string {
  return person.eat();
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- ❌ Anti-pattern: fat Worker interface ---');
  const robotAP = new RobotWorkerAntiPattern();
  console.log(robotAP.work());
  try {
    robotAP.eat();
  } catch (err) {
    console.log(`❌ ISP VIOLATION caught at runtime: ${(err as Error).message}`);
  }

  console.log('\n--- ✅ Refactored: segregated role interfaces ---');
  const human = new HumanWorker();
  const robot = new RobotWorker();
  const manager = new Manager();

  console.log(assignTask(human));
  console.log(assignTask(robot));
  // assignTask(manager) จะ "compile ไม่ผ่าน" เพราะ Manager ไม่ implement Workable
  // นี่คือ ISP ทำงานจริง: type system ป้องกันการเรียก method ที่ไม่เกี่ยวข้องตั้งแต่ compile time

  console.log(scheduleLunch(human));
  console.log(scheduleLunch(manager));
  console.log(manager.attendMeeting());

  console.log(
    '\nสังเกต: RobotWorker ไม่ถูกบังคับให้มี eat()/sleep()/attendMeeting() อีกต่อไป ' +
      'และ compiler จะช่วยจับให้ทันทีถ้ามีใครพยายามเรียก method ที่ type นั้นไม่รองรับ',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export { HumanWorkerAntiPattern, RobotWorkerAntiPattern, HumanWorker, RobotWorker, Manager };
export type { Workable, Eatable, Sleepable, MeetingAttendee };
