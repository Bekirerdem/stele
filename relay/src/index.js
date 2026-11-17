// The Stele relay. Two jobs, both because a browser can't do them alone:
//
// 1. The answer shield. The NEAR AI API key can't live in a browser, so the
//    relay adds it to requests the browser has ALREADY encrypted to the
//    model's attested enclave key, and passes the reply back. It refuses any
//    chat request that is not end-to-end encrypted, so it can never be used to
//    forward a readable draft by mistake. It sees ciphertext only.
//
// 2. The answer store. The chain keeps each answer's SHA-256 digest; the blob
//    (padded, and sealed to the asker when the question is asker-only) is kept
//    here, addressed by that digest. A blob whose bytes don't hash to its
//    address is refused, so the store can't swap one answer for another
//    without it showing against the chain.
//
// Privacy of the relay itself: observability is off in wrangler.jsonc and the
// code logs nothing. Rate limits are keyed per address inside Cloudflare and
// never stored. The relay never sees which member sent a blob: the member
// proves membership on chain, not here.
//
// SPDX-License-Identifier: MIT

const UPSTREAM = 'https://cloud-api.near.ai';
const NVIDIA_ATTEST = 'https://nras.attestation.nvidia.com/v3/attest/gpu';
const INTEL_PCS = 'https://api.trustedservices.intel.com';
const MODELS = new Set(['z-ai/glm-5.3-flash', 'Qwen/Qwen3.8-27B']);
const MAX_CHAT_BYTES = 256 * 1024;
const MAX_TOKENS = 4000;
const MAX_BLOB_BYTES = 16384 + 512; // the largest padding bucket plus the sealed envelope

const REQUIRED_ENCRYPTION_HEADERS = ['x-client-pub-key', 'x-model-pub-key', 'x-encrypt-all-fields'];
const FORWARDED_HEADERS = ['content-type', 'accept', 'x-client-pub-key', 'x-model-pub-key', 'x-encrypt-all-fields', 'x-encryption-version', 'x-signing-algo', 'x-no-aliasing'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': FORWARDED_HEADERS.join(', '),
};
const reply = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const fail = (status, message) => reply(status, { error: { message } });
const withCors = async (responsePromise) => {
  const r = await responsePromise;
  const out = new Response(r.body, r);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
};

function upstreamHeaders(request, env, withKey) {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (withKey) headers.set('authorization', `Bearer ${env.NEARAI_API_KEY}`);
  return headers;
}

async function limited(limiter, request) {
  if (!limiter) return false; // not configured in local development
  const { success } = await limiter.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' });
  return !success;
}

async function chat(request, env) {
  const missing = REQUIRED_ENCRYPTION_HEADERS.filter((h) => !request.headers.get(h));
  if (missing.length > 0 || request.headers.get('x-encrypt-all-fields') !== 'true') {
    return fail(400, 'This relay only forwards answers that are encrypted to the model on the device.');
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_CHAT_BYTES) return fail(413, 'The answer is too long.');
  let outline;
  try {
    outline = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return fail(400, 'The request body is not JSON.');
  }
  if (!MODELS.has(outline.model)) return fail(400, 'This relay does not serve that model.');
  if (typeof outline.max_tokens !== 'number' || outline.max_tokens > MAX_TOKENS) return fail(400, 'max_tokens is missing or too high.');
  if (outline.stream) return fail(400, 'Streaming is not used.');
  if (await limited(env.CHAT_LIMIT, request)) return fail(429, 'Too many checks from this network in a short time. Try again in a minute.');
  // The exact bytes go on unchanged: the model signs a hash of them.
  return withCors(fetch(`${UPSTREAM}/v1/chat/completions`, { method: 'POST', headers: upstreamHeaders(request, env, true), body }));
}

const HEX64 = /^[0-9a-f]{64}$/;

async function sha256Hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function putBlob(request, env, address, digest) {
  if (await limited(env.BLOB_LIMIT, request)) return fail(429, 'Too many answers from this network in a short time.');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BLOB_BYTES) return fail(413, 'Not an answer blob.');
  if ((await sha256Hex(bytes)) !== digest) return fail(400, 'The blob does not hash to its address.');
  const key = `${address}/${digest}`;
  if (!(await env.BLOBS.get(key))) await env.BLOBS.put(key, bytes);
  return reply(201, { digest });
}

async function getBlob(request, env, address, digest) {
  if (await limited(env.LOOKUP_LIMIT, request)) return fail(429, 'Too many requests. Try again in a minute.');
  const blob = await env.BLOBS.get(`${address}/${digest}`, { type: 'arrayBuffer' });
  if (!blob) return fail(404, 'No such answer.');
  return new Response(blob, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', ...CORS } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const { pathname, search } = url;

    const blob = pathname.match(/^\/q\/([0-9a-f]{64})\/blob\/([0-9a-f]{64})$/);
    if (blob) {
      const [, address, digest] = blob;
      if (!HEX64.test(digest)) return fail(400, 'Bad digest.');
      if (request.method === 'PUT') return putBlob(request, env, address, digest);
      if (request.method === 'GET') return getBlob(request, env, address, digest);
      return fail(405, 'Method not allowed.');
    }

    if (pathname.startsWith('/v1/') && !env.NEARAI_API_KEY) return fail(500, 'The relay has no API key configured.');
    if (request.method === 'POST' && pathname === '/v1/chat/completions') return chat(request, env);

    if (await limited(env.LOOKUP_LIMIT, request)) return fail(429, 'Too many requests. Try again in a minute.');
    if (request.method === 'GET' && (pathname === '/v1/attestation/report' || pathname.startsWith('/v1/model/') || pathname.startsWith('/v1/signature/'))) {
      return withCors(fetch(`${UPSTREAM}${pathname}${search}`, { headers: upstreamHeaders(request, env, true) }));
    }
    if (request.method === 'POST' && pathname === '/attestation/nvidia') {
      // NVIDIA's GPU attestation service does not allow browser requests; passed through untouched.
      const body = await request.arrayBuffer();
      if (body.byteLength > 2 * 1024 * 1024) return fail(413, 'Attestation evidence is too large.');
      return withCors(fetch(NVIDIA_ATTEST, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body }));
    }
    if (request.method === 'GET' && /^\/attestation\/intel\/(sgx|tdx)\/certification\/v4\//.test(pathname)) {
      return withCors(fetch(`${INTEL_PCS}${pathname.slice('/attestation/intel'.length)}${search}`, { headers: { accept: request.headers.get('accept') ?? '*/*' } }));
    }
    if (request.method === 'GET' && pathname === '/') return reply(200, { service: 'stele-relay', ok: true });
    return fail(404, 'Not found.');
  },
};
