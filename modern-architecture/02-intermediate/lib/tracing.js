/**
 * Observability helpers — correlation / tracing แบบเบา ๆ สำหรับ lab
 * ระดับ Expert จะขยายเป็น OpenTelemetry-style spans
 */

import { randomUUID } from 'node:crypto';

export function newCorrelationId() {
  return randomUUID();
}

export function createTracer(serviceName) {
  const spans = [];

  function startSpan(name, parent = null, attrs = {}) {
    const span = {
      traceId: parent?.traceId ?? randomUUID().replace(/-/g, ''),
      spanId: randomUUID().replace(/-/g, '').slice(0, 16),
      parentSpanId: parent?.spanId ?? null,
      serviceName,
      name,
      startTime: Date.now(),
      endTime: null,
      status: 'ok',
      attributes: { ...attrs },
      events: [],
    };

    return {
      span,

      setAttribute(k, v) {
        span.attributes[k] = v;
      },

      addEvent(name, attrs = {}) {
        span.events.push({ name, at: Date.now(), ...attrs });
      },

      recordError(err) {
        span.status = 'error';
        span.attributes['error.message'] = err.message;
        span.attributes['error.name'] = err.name;
      },

      end() {
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        spans.push({ ...span });
        return span;
      },
    };
  }

  return {
    startSpan,

    getSpans: () => [...spans],

    clear: () => {
      spans.length = 0;
    },

    /** ส่งออกเป็น JSON lines — จำลอง export ไป collector */
    flush() {
      for (const s of spans) {
        console.log(JSON.stringify({ type: 'span', ...s }));
      }
      const copy = [...spans];
      spans.length = 0;
      return copy;
    },
  };
}

/** ดึง / สร้าง correlation id จาก headers */
export function correlationFromHeaders(headers = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return h['x-correlation-id'] || h['x-request-id'] || newCorrelationId();
}
