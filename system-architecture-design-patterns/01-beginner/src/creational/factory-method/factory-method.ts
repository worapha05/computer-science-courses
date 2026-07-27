/**
 * Creational Pattern — Factory Method
 * ================================================
 * เจตนา: ให้ subclass (หรือ factory function) เป็นผู้ตัดสินใจว่าจะสร้าง "concrete product"
 * ตัวไหน โดยฝั่งที่เรียกใช้งาน (client) รู้จักแค่ "interface กลาง" ของ product เท่านั้น
 *
 * ต่างจาก Abstract Factory อย่างไร?
 * - Factory Method: โฟกัสที่การสร้าง "product ตัวเดียว" ผ่าน method หนึ่งตัว
 * (มักใช้ตอนมี "หนึ่งกลุ่มของสิ่งที่ผลิตได้หลายแบบ" เช่น Notification ทุกชนิด)
 * - Abstract Factory: โฟกัสที่การสร้าง "ตระกูลของ product หลายตัวที่ต้องเข้าคู่กัน"
 * (ดูตัวอย่างในไฟล์ abstract-factory.ts)
 *
 * ตัวอย่างนี้: ระบบแจ้งเตือนผู้ใช้ (Email / SMS / Push) ที่ต้องเลือก "ผู้สร้าง" ตาม
 * ช่องทางที่ผู้ใช้เลือกไว้ โดยโค้ดฝั่ง client ไม่ต้องรู้เลยว่าเบื้องหลังสร้าง object ยังไง
 */

// ===========================================================================
// Product interface — สัญญากลางที่ทุกช่องทางแจ้งเตือนต้อง implement
// ===========================================================================

interface Notification {
  readonly channel: 'email' | 'sms' | 'push';
  send(recipient: string, message: string): string;
}

// ===========================================================================
// Concrete Products
// ===========================================================================

class EmailNotification implements Notification {
  readonly channel = 'email' as const;

  send(recipient: string, message: string): string {
    return `[Email] To: ${recipient} | Subject: Notification | Body: ${message}`;
  }
}

class SmsNotification implements Notification {
  readonly channel = 'sms' as const;

  send(recipient: string, message: string): string {
    return `[SMS] To: ${recipient} | Text: ${message} (160 chars max)`;
  }
}

class PushNotification implements Notification {
  readonly channel = 'push' as const;

  send(recipient: string, message: string): string {
    return `[Push] Device token: ${recipient} | Payload: {"title":"Alert","body":"${message}"}`;
  }
}

// ===========================================================================
// Creator (abstract) — ประกาศ Factory Method ชื่อ createNotification()
// ===========================================================================
// แนวคิดหลัก: NotificationCreator แต่ละ subclass "เชี่ยวชาญ" การสร้าง notification
// ของช่องทางตัวเอง แต่ template method (dispatch) ใช้ร่วมกันได้โดยไม่ต้องรู้จัก
// concrete class เลย — เพราะเรียกผ่าน createNotification() ที่เป็น abstract method

abstract class NotificationCreator {
  /** Factory Method — ให้ subclass เป็นผู้กำหนดว่าจะสร้าง concrete product ตัวไหน */
  protected abstract createNotification(): Notification;

  /**
   * Template ที่ใช้ร่วมกันทุกช่องทาง: logging + validation + ส่งจริง
   * โค้ดส่วนนี้เขียนครั้งเดียว ใช้ร่วมกับทุก subclass ผ่าน polymorphism
   */
  dispatch(recipient: string, message: string): string {
    const notification = this.createNotification();
    console.log(`[NotificationCreator] Dispatching via "${notification.channel}" channel...`);
    return notification.send(recipient, message);
  }
}

// ===========================================================================
// Concrete Creators
// ===========================================================================

class EmailNotificationCreator extends NotificationCreator {
  protected createNotification(): Notification {
    return new EmailNotification();
  }
}

class SmsNotificationCreator extends NotificationCreator {
  protected createNotification(): Notification {
    return new SmsNotification();
  }
}

class PushNotificationCreator extends NotificationCreator {
  protected createNotification(): Notification {
    return new PushNotification();
  }
}

// ===========================================================================
// Registry-based factory function — ทางเลือกที่ practical กว่าในโค้ดจริงจำนวนมาก
// ===========================================================================
// ในโปรดักชัน หลายทีมเลือกใช้ "factory function + registry" แทนการไล่ subclass
// เพราะเพิ่มช่องทางใหม่ได้โดยไม่ต้องสร้าง class Creator ใหม่ทุกครั้ง (ยังคง OCP-compliant)

type NotificationChannel = Notification['channel'];

const notificationFactories: Record<NotificationChannel, () => Notification> = {
  email: () => new EmailNotification(),
  sms: () => new SmsNotification(),
  push: () => new PushNotification(),
};

function createNotificationByChannel(channel: NotificationChannel): Notification {
  const factory = notificationFactories[channel];
  return factory();
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- Factory Method via Creator subclasses ---');
  const creators: NotificationCreator[] = [
    new EmailNotificationCreator(),
    new SmsNotificationCreator(),
    new PushNotificationCreator(),
  ];

  for (const creator of creators) {
    console.log(
      creator.dispatch(
        'user@example.com / +66812345678 / device-token-xyz',
        'Your order has shipped!',
      ),
    );
  }

  console.log('\n--- Factory function + registry (practical alternative) ---');
  for (const channel of ['email', 'sms', 'push'] as const) {
    const notification = createNotificationByChannel(channel);
    console.log(
      notification.send('recipient-id-123', 'Reminder: your subscription renews tomorrow'),
    );
  }

  console.log(
    '\nสังเกต: client code (runDemo) ไม่เคยเขียน `new EmailNotification()` ตรง ๆ เลย ' +
      'มันรู้จักแค่ NotificationCreator/Notification (abstraction) เท่านั้น ' +
      "การเลือก concrete class ที่แท้จริงถูก 'เลื่อน' ไปอยู่ที่ subclass/registry",
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  EmailNotification,
  SmsNotification,
  PushNotification,
  NotificationCreator,
  EmailNotificationCreator,
  SmsNotificationCreator,
  PushNotificationCreator,
  createNotificationByChannel,
};
export type { Notification, NotificationChannel };
