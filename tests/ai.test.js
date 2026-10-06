import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, buildRequest, parseResponse, checkApiUrl, fileExt, DEFAULT_API_URL, DEFAULT_MODEL } from '../js/core/ai.js';

test('AI context carries metadata only: never bytes, hashes or file contents', () => {
  const files = [
    { id: 'f1', name: 'trade_license_2026.pdf', pages: 1, bytes: new Uint8Array([1, 2, 3]), hash: 'abc123' },
    { id: 'f2', name: 'scan_0042.pdf', pages: 1, bytes: new Uint8Array([4]), hash: 'def456', error: null },
    { id: 'f3', name: 'broken.pdf', pages: null, bytes: new Uint8Array([5]), hash: 'ghi789', error: { key: 'err.file.damaged' } },
  ];
  const ctx = buildContext({
    tender: { tender_id: 'T-1', submission_deadline: '2026-10-20' },
    requirements: [{ id: 'R01', order: 1, title_en: 'Trade License', title_bn: 'ট্রেড', mandatory: true, has_expiry: true },
      { id: 'R02', order: 2, title_en: 'TIN', title_bn: 'টিন', mandatory: true, has_expiry: false }],
    files, matches: new Map([['R01', 'f1']]), expiries: new Map([['R01', '2027-06-30']]),
    statuses: [{ id: 'R01', status: 'OK' }, { id: 'R02', status: 'Missing' }], duplicates: [['a.pdf', 'b.pdf']],
  });
  const json = JSON.stringify(ctx);
  for (const secret of ['bytes', 'hash', 'abc123', 'def456', 'ghi789']) assert.ok(!json.includes(secret), secret);
  assert.deepEqual(ctx.documents[0].file, { name: 'trade_license_2026.pdf', extension: 'pdf', pages: 1 });
  assert.equal(ctx.documents[0].expiry_date, '2027-06-30');
  assert.equal(ctx.documents[1].status, 'Missing');
  assert.ok(!('expiry_date' in ctx.documents[1]));
  assert.deepEqual(ctx.unmatched_files.map((f) => [f.name, f.problem]), [['scan_0042.pdf', undefined], ['broken.pdf', 'err.file.damaged']]);
  assert.deepEqual(ctx.duplicate_groups, [['a.pdf', 'b.pdf']]);
  const req = buildRequest({ model: '  ', lang: 'bn', context: ctx, question: ' কোনটা আগে? ' });
  assert.equal(req.model, DEFAULT_MODEL);
  assert.ok(req.max_tokens > 0 && req.messages.length === 1 && req.messages[0].role === 'user');
  assert.ok(req.system.includes('Bangla'));
  assert.ok(req.messages[0].content.startsWith('Question: কোনটা আগে?'));
  assert.ok(!('thinking' in req) && !('tool_choice' in req));
  assert.ok(buildRequest({ model: 'claude-haiku-4-5', lang: 'en', context: ctx, question: '' }).system.includes('English'));
});

test('AI response parsing and API URL check', () => {
  assert.equal(parseResponse(200, { content: [{ type: 'text', text: 'Hi' }, { type: 'text', text: 'there' }], stop_reason: 'end_turn' }).text, 'Hi\nthere');
  assert.equal(parseResponse(200, { content: [{ type: 'text', text: 'cut' }], stop_reason: 'max_tokens' }).truncated, true);
  const err = parseResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'bad key' } });
  assert.equal(err.key, 'err.ai.api');
  assert.ok(err.params.msg.includes('bad key'));
  assert.equal(parseResponse(200, { content: [], stop_reason: 'refusal' }).key, 'err.ai.refusal');
  assert.equal(parseResponse(200, { content: [] }).key, 'err.ai.empty');
  assert.equal(parseResponse(500, null).key, 'err.ai.api');
  assert.equal(checkApiUrl(DEFAULT_API_URL), null);
  assert.equal(checkApiUrl('http://example.com/v1/messages').key, 'err.ai.url');
  assert.equal(checkApiUrl('http://localhost:8787/v1/messages'), null);
  assert.equal(checkApiUrl('not a url').key, 'err.ai.url');
  assert.equal(checkApiUrl('').key, 'err.ai.url');
  assert.equal(fileExt('a.PDF'), 'pdf');
  assert.equal(fileExt('noext'), '');
});
