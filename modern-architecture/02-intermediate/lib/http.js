/**
 * Shared helpers — จำลอง AWS Lambda / API Gateway event แบบ local
 * ใช้ร่วมทุก examples / lab ใน bootcamp นี้
 */

/** sleep utility สำหรับ demo / backoff / cold-start simulation */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * สร้าง API Gateway HTTP API (v2) event แบบย่อ
 * ใกล้เคียง payload ที่ Lambda ได้จาก API Gateway
 */
export function makeHttpEvent({
  method = 'GET',
  path = '/',
  query = {},
  headers = {},
  body = null,
  pathParams = {},
} = {}) {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(query).toString(),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    queryStringParameters: Object.keys(query).length ? query : undefined,
    pathParameters: Object.keys(pathParams).length ? pathParams : undefined,
    requestContext: {
      http: {
        method,
        path,
        sourceIp: '127.0.0.1',
        userAgent: 'modern-architecture-bootcamp',
      },
      requestId: `req-${Date.now()}`,
    },
    body: body == null ? null : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

/** แปลง Lambda proxy response → Express response */
export function sendLambdaResponse(res, lambdaResult) {
  const status = lambdaResult.statusCode ?? 200;
  const headers = lambdaResult.headers ?? {};
  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }
  if (lambdaResult.multiValueHeaders) {
    for (const [k, values] of Object.entries(lambdaResult.multiValueHeaders)) {
      res.setHeader(k, values);
    }
  }
  const body = lambdaResult.body ?? '';
  if (lambdaResult.isBase64Encoded) {
    return res.status(status).send(Buffer.from(body, 'base64'));
  }
  const ct = headers['content-type'] || headers['Content-Type'] || '';
  if (ct.includes('application/json') || looksLikeJson(body)) {
    try {
      return res.status(status).json(JSON.parse(body));
    } catch {
      /* fall through */
    }
  }
  return res.status(status).send(body);
}

function looksLikeJson(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

/** CORS headers ที่นิยมใช้กับ public API */
export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-Id,X-Correlation-Id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };
}

/** Structured log แบบง่าย (JSON line) — เหมาะกับ CloudWatch / Cloud Logging */
export function log(level, message, fields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** In-memory store สำหรับ demo (อย่าใช้ใน production) */
export function createMemoryStore() {
  const map = new Map();

  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },

    async set(key, value) {
      map.set(key, value);
      return value;
    },

    async del(key) {
      map.delete(key);
    },

    async keys(prefix = '') {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },

    clear() {
      map.clear();
    },
  };
}
