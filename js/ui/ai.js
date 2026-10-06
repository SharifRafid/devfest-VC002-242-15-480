// Optional AI help panel (bonus). Isolated on purpose: it only reads app state through getContext(),
// and any failure here leaves the rest of the app untouched. The key lives in the input field only.
import { t, getLang } from '../i18n.js';
import { h, clear, $ } from './dom.js';
import { findDuplicates } from '../core/match.js';
import { DEFAULT_API_URL, DEFAULT_MODEL, checkApiUrl, buildContext, buildRequest, headersFor, parseResponse } from '../core/ai.js';

export function initAi(getContext, announce) {
  const btn = $('ai-ask');
  if (!btn) return;
  const out = $('ai-answer'), stateEl = $('ai-state');
  $('ai-url').value = DEFAULT_API_URL;
  $('ai-model').value = DEFAULT_MODEL;
  let busy = false;
  let last = null; // {key, params, cls} so the message re-translates on a language switch
  let lastAnswer = null; // {text, truncated}
  const setState = (key, params, cls) => {
    last = key ? { key, params: params || {}, cls: cls || 'muted' } : null;
    stateEl.textContent = last ? t(last.key, last.params) : '';
    stateEl.className = `small ${last ? last.cls : 'muted'}`;
  };
  const showAnswer = () => {
    clear(out);
    out.hidden = !lastAnswer;
    if (!lastAnswer) return;
    out.append(h('h3', { text: t('ai.answerHeading') }),
      h('pre', { class: 'ai-text', text: lastAnswer.text }),
      h('p', { class: 'help small', text: t(lastAnswer.truncated ? 'ai.truncated' : 'ai.disclaimer') }));
  };
  document.addEventListener('langchange', () => { if (last) setState(last.key, last.params, last.cls); showAnswer(); });
  $('ai-clear').addEventListener('click', () => { lastAnswer = null; showAnswer(); setState(''); btn.focus(); });

  btn.addEventListener('click', async () => {
    if (busy) return;
    const ctx = getContext();
    if (!ctx || !ctx.data) { setState('ai.needData', {}, 'err-text'); announce('ai.needData', {}, 'info'); return; }
    const key = $('ai-key').value.trim();
    if (!key) { setState('ai.needKey', {}, 'err-text'); $('ai-key').focus(); return; }
    const urlErr = checkApiUrl($('ai-url').value);
    if (urlErr) { setState(urlErr.key, urlErr.params, 'err-text'); $('ai-url').focus(); return; }
    busy = true; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    setState('ai.busy', {}, 'muted');
    try {
      const files = [...ctx.state.files.values()];
      const byId = new Map(files.map((f) => [f.id, f]));
      const duplicates = [...findDuplicates(files).values()].map((ids) => ids.map((id) => byId.get(id).name));
      const context = buildContext({
        tender: ctx.data.tender, requirements: ctx.data.requirements, files,
        matches: ctx.state.matches, expiries: ctx.state.expiries, statuses: ctx.statuses, duplicates,
      });
      const body = buildRequest({ model: $('ai-model').value, lang: getLang(), context, question: $('ai-question').value });
      const res = await fetch($('ai-url').value.trim(), { method: 'POST', headers: headersFor(key), body: JSON.stringify(body) });
      let json = null;
      try { json = await res.json(); } catch { json = null; }
      const parsed = parseResponse(res.status, json);
      if (!parsed.ok) { setState(parsed.key, parsed.params, 'err-text'); announce(parsed.key, parsed.params, 'error'); return; }
      lastAnswer = { text: parsed.text, truncated: parsed.truncated };
      showAnswer();
      setState('ai.done', {}, 'ok-text');
      announce('ai.done', {}, 'ok');
    } catch (e) {
      const params = { msg: String((e && e.message) || e) };
      setState('err.ai.network', params, 'err-text');
      announce('err.ai.network', params, 'error');
    } finally {
      busy = false; btn.disabled = false; btn.setAttribute('aria-busy', 'false');
    }
  });
}
