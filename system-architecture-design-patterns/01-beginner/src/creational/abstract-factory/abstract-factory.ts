/**
 * Creational Pattern — Abstract Factory
 * ================================================
 * เจตนา: สร้าง "ตระกูลของ object ที่เกี่ยวข้องกัน" (family of related products)
 * โดยไม่ต้องระบุ concrete class ตรง ๆ และการันตีว่า product ทุกตัวที่สร้างจาก factory
 * เดียวกันจะ "เข้ากันได้" (consistent) เสมอ
 *
 * ตัวอย่างนี้: ระบบ UI Theme (Light / Dark) ที่ต้องสร้าง Button และ Input ให้เข้าธีมกัน
 * - ถ้าเลือก LightThemeFactory -> ได้ LightButton + LightInput (สีสว่างทั้งคู่)
 * - ถ้าเลือก DarkThemeFactory -> ได้ DarkButton + DarkInput (สีเข้มทั้งคู่)
 * ปัญหาที่ Abstract Factory แก้: ป้องกันการ "ผสมธีมมั่ว" เช่น LightButton คู่กับ DarkInput
 * ซึ่งจะเกิดขึ้นได้ง่ายถ้าปล่อยให้ client code เลือก new แต่ละ component เองอย่างอิสระ
 */

// ===========================================================================
// Abstract Products — สัญญากลางของ "ชิ้นส่วน UI" แต่ละชนิด
// ===========================================================================

interface Button {
  render(): string;
  onClick(handler: () => void): void;
}

interface Input {
  render(placeholder: string): string;
}

// ===========================================================================
// Concrete Products — ตระกูล "Light"
// ===========================================================================

class LightButton implements Button {
  private clickHandler: (() => void) | undefined;

  render(): string {
    return '<button style="background:#fff;color:#111;border:1px solid #ccc">Click me</button>';
  }

  onClick(handler: () => void): void {
    this.clickHandler = handler;
    this.clickHandler();
  }
}

class LightInput implements Input {
  render(placeholder: string): string {
    return `<input style="background:#fff;color:#111;border:1px solid #ccc" placeholder="${placeholder}" />`;
  }
}

// ===========================================================================
// Concrete Products — ตระกูล "Dark"
// ===========================================================================

class DarkButton implements Button {
  private clickHandler: (() => void) | undefined;

  render(): string {
    return '<button style="background:#1e1e1e;color:#fafafa;border:1px solid #444">Click me</button>';
  }

  onClick(handler: () => void): void {
    this.clickHandler = handler;
    this.clickHandler();
  }
}

class DarkInput implements Input {
  render(placeholder: string): string {
    return `<input style="background:#1e1e1e;color:#fafafa;border:1px solid #444" placeholder="${placeholder}" />`;
  }
}

// ===========================================================================
// Abstract Factory — สัญญากลางของ "ผู้ผลิตทั้งตระกูล"
// ===========================================================================

interface UiThemeFactory {
  readonly themeName: 'light' | 'dark';
  createButton(): Button;
  createInput(): Input;
}

// ===========================================================================
// Concrete Factories — ผู้ผลิตแต่ละตระกูล การันตีว่า product ที่ออกมาเข้าธีมกันเสมอ
// ===========================================================================

class LightThemeFactory implements UiThemeFactory {
  readonly themeName = 'light' as const;

  createButton(): Button {
    return new LightButton();
  }

  createInput(): Input {
    return new LightInput();
  }
}

class DarkThemeFactory implements UiThemeFactory {
  readonly themeName = 'dark' as const;

  createButton(): Button {
    return new DarkButton();
  }

  createInput(): Input {
    return new DarkInput();
  }
}

// ===========================================================================
// Client — ใช้งานผ่าน abstraction เท่านั้น ไม่รู้จัก LightButton/DarkInput ตรง ๆ
// ===========================================================================
// LoginForm ไม่สนใจว่าธีมไหนถูกเลือก มันแค่ขอ "Button" และ "Input" จาก factory
// ที่ inject เข้ามา แล้วเชื่อว่า factory จะคืนของที่เข้าคู่กันมาให้เสมอ

class LoginForm {
  private readonly submitButton: Button;
  private readonly usernameInput: Input;
  private readonly passwordInput: Input;

  constructor(factory: UiThemeFactory) {
    this.submitButton = factory.createButton();
    this.usernameInput = factory.createInput();
    this.passwordInput = factory.createInput();
  }

  render(): string {
    return [
      this.usernameInput.render('Username'),
      this.passwordInput.render('Password'),
      this.submitButton.render(),
    ].join('\n');
  }
}

/** จำลอง registry เลือก factory ตาม theme name ที่ผู้ใช้ตั้งไว้ */
function resolveThemeFactory(theme: 'light' | 'dark'): UiThemeFactory {
  return theme === 'light' ? new LightThemeFactory() : new DarkThemeFactory();
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- Light theme family ---');
  const lightForm = new LoginForm(resolveThemeFactory('light'));
  console.log(lightForm.render());

  console.log('\n--- Dark theme family ---');
  const darkForm = new LoginForm(resolveThemeFactory('dark'));
  console.log(darkForm.render());

  console.log(
    "\nสังเกต: LoginForm ไม่มีทาง 'ผสมธีมผิด' เช่น ได้ LightButton คู่กับ DarkInput " +
      'เพราะ createButton() และ createInput() มาจาก factory ตัวเดียวกันเสมอ ' +
      "-> Abstract Factory การันตี 'ความเข้ากันได้' ของ product ทั้งตระกูล",
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  LightButton,
  LightInput,
  DarkButton,
  DarkInput,
  LightThemeFactory,
  DarkThemeFactory,
  LoginForm,
  resolveThemeFactory,
};
export type { Button, Input, UiThemeFactory };
