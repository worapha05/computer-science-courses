/**
 * COMMAND PATTERN — Undoable Text Editor with Command Queue + Undo/Redo
 * ----------------------------------------------------------------
 * TH: Command แปลง "การกระทำ" (request) ให้เป็น object ที่มี execute()/undo()
 *  ของตัวเอง ทำให้เราสามารถ: เข้าคิว (queue), บันทึก log, undo/redo,
 *  ทำ macro (รวมหลาย command เป็นชุดเดียว) โดยไม่ผูก caller เข้ากับ receiver
 *  ตรง ๆ
 * EN: Command turns a request into a self-contained object with execute()/
 *  undo(). This enables queueing, logging, undo/redo, and macro-recording
 *  without coupling the invoker directly to the receiver.
 *
 * ส่วนประกอบ:
 * TH: - Command: interface ที่มี execute()/undo()
 *  - ConcreteCommand: การกระทำจริงหนึ่งอย่าง เก็บ state ที่พอจะ undo ได้
 *  - Invoker: ตัวเรียก execute (เช่น History/CommandQueue) ไม่รู้ว่า command ทำอะไร
 *  - Receiver: object ที่ถูกกระทำจริง (เช่น TextDocument)
 *
 * รันตัวอย่าง / Run:
 * npx tsx behavioral/command/command.ts
 */

// ============================================================================
// 1) RECEIVER — object ที่ command จะไปสั่งให้ทำงาน
// ============================================================================

export class TextDocument {
  private content = '';

  insert(text: string, position: number): void {
    this.content = this.content.slice(0, position) + text + this.content.slice(position);
  }

  delete(position: number, length: number): string {
    const removed = this.content.slice(position, position + length);
    this.content = this.content.slice(0, position) + this.content.slice(position + length);
    return removed;
  }

  get text(): string {
    return this.content;
  }
}

// ============================================================================
// 2) COMMAND INTERFACE
// ============================================================================

export interface Command {
  readonly description: string;
  execute(): void;
  undo(): void;
}

// ============================================================================
// 3) CONCRETE COMMANDS
// ============================================================================

export class InsertTextCommand implements Command {
  readonly description: string;

  constructor(
    private readonly doc: TextDocument,
    private readonly text: string,
    private readonly position: number,
  ) {
    this.description = `Insert "${text}" at ${position}`;
  }

  execute(): void {
    this.doc.insert(this.text, this.position);
  }

  undo(): void {
    // TH: การ undo ของ "insert" คือ "delete" ความยาวเท่ากันที่ตำแหน่งเดิม
    this.doc.delete(this.position, this.text.length);
  }
}

export class DeleteTextCommand implements Command {
  readonly description: string;
  private deletedText = '';

  constructor(
    private readonly doc: TextDocument,
    private readonly position: number,
    private readonly length: number,
  ) {
    this.description = `Delete ${length} chars at ${position}`;
  }

  execute(): void {
    // TH: ต้องจำ "สิ่งที่ถูกลบ" ไว้ ไม่งั้น undo() จะไม่รู้ว่าต้องคืนอะไร
    // EN: must remember what was deleted, otherwise undo() has nothing to restore
    this.deletedText = this.doc.delete(this.position, this.length);
  }

  undo(): void {
    this.doc.insert(this.deletedText, this.position);
  }
}

/** TH: Macro Command — รวมหลาย command เป็นชุดเดียว execute/undo ตามลำดับที่ถูกต้อง
 * EN: Macro Command — bundles multiple commands, executing/undoing in correct order */
export class MacroCommand implements Command {
  readonly description: string;

  constructor(private readonly commands: Command[]) {
    this.description = `Macro(${commands.map((c) => c.description).join(' + ')})`;
  }

  execute(): void {
    for (const command of this.commands) command.execute();
  }

  undo(): void {
    // TH: undo ต้องทำ "ย้อนลำดับ" (reverse order) เหมือน stack ปกติ
    // EN: undo must reverse order, like unwinding a stack
    for (const command of [...this.commands].reverse()) command.undo();
  }
}

// ============================================================================
// 4) INVOKER — CommandQueue พร้อม undo/redo history
// Invoker ไม่รู้จัก TextDocument เลย รู้จักแค่ Command interface
// ============================================================================

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  execute(command: Command): void {
    console.log(` [History] execute: ${command.description}`);
    command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0; // TH: การกระทำใหม่ล้าง redo stack ทิ้ง (มาตรฐานของ editor ทุกตัว)
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      console.log(' [History] nothing to undo');
      return false;
    }
    console.log(` [History] undo: ${command.description}`);
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      console.log(' [History] nothing to redo');
      return false;
    }
    console.log(` [History] redo: ${command.description}`);
    command.execute();
    this.undoStack.push(command);
    return true;
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== Command Pattern: Undoable text editor ==\n');

  const doc = new TextDocument();
  const history = new CommandHistory();

  history.execute(new InsertTextCommand(doc, 'Hello', 0));
  console.log(` doc = "${doc.text}"`);

  history.execute(new InsertTextCommand(doc, ' World', 5));
  console.log(` doc = "${doc.text}"`);

  history.execute(new DeleteTextCommand(doc, 0, 6)); // ลบ "Hello "
  console.log(` doc = "${doc.text}"`);

  console.log('\n--- Undo x2 ---');
  history.undo();
  console.log(` doc = "${doc.text}"`);
  history.undo();
  console.log(` doc = "${doc.text}"`);

  console.log('\n--- Redo x1 ---');
  history.redo();
  console.log(` doc = "${doc.text}"`);

  console.log('\n--- Macro command: insert two phrases atomically ---');
  const macro = new MacroCommand([
    new InsertTextCommand(doc, '!', doc.text.length),
    new InsertTextCommand(doc, ' (macro)', doc.text.length + 1),
  ]);
  history.execute(macro);
  console.log(` doc = "${doc.text}"`);

  console.log('\n--- Undo macro (both inserts reverted together) ---');
  history.undo();
  console.log(` doc = "${doc.text}"`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
