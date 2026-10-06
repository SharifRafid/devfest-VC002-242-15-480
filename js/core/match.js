// Pure matching rules (4.3, 4.6). All functions return new Maps; inputs are never mutated.

// files: iterable of {id, hash}. Returns Map hash -> [fileIds] for groups of size >= 2.
export function findDuplicates(files) {
  const byHash = new Map();
  for (const f of files) {
    if (!f.hash) continue;
    if (!byHash.has(f.hash)) byHash.set(f.hash, []);
    byHash.get(f.hash).push(f.id);
  }
  const dups = new Map();
  for (const [h, ids] of byHash) if (ids.length > 1) dups.set(h, ids);
  return dups;
}

export function reqOfFile(matches, fileId) {
  for (const [reqId, fid] of matches) if (fid === fileId) return reqId;
  return null;
}

// Assign fileId to reqId. Moving a file from one doc to another is allowed (it is unassigned
// from the old one). A duplicate copy cannot be matched to a different document than its twin.
// Returns {ok:true, matches} or {ok:false, error:{key, params}}.
export function assign(matches, reqId, fileId, filesById) {
  const file = filesById.get(fileId);
  if (!file) return { ok: false, error: { key: 'err.match.noFile', params: {} } };
  if (file.hash) {
    for (const [otherReq, otherFid] of matches) {
      if (otherFid === fileId || otherReq === reqId) continue;
      const other = filesById.get(otherFid);
      if (other && other.hash === file.hash) {
        return { ok: false, error: { key: 'err.match.duplicate', params: { name: file.name, other: other.name } } };
      }
    }
  }
  const next = new Map(matches);
  const prevReq = reqOfFile(next, fileId);
  if (prevReq !== null) next.delete(prevReq);
  next.set(reqId, fileId);
  return { ok: true, matches: next, movedFrom: prevReq !== null && prevReq !== reqId ? prevReq : null };
}

export function unassign(matches, reqId) {
  const next = new Map(matches);
  next.delete(reqId);
  return next;
}

// Removing a file also removes its match.
export function removeFileMatch(matches, fileId) {
  const next = new Map(matches);
  const r = reqOfFile(next, fileId);
  if (r !== null) next.delete(r);
  return next;
}

// Auto-match suggestion (bonus): normalise names and look for title words in the file name.
export function normalize(s) {
  return String(s).toLowerCase().replace(/\.pdf$/i, '').replace(/[^a-z0-9ঀ-৿]+/g, ' ').trim();
}

const SYNONYMS = new Map([
  ['certificate', ['cert', 'certificate']],
  ['license', ['license', 'licence', 'lic']],
  ['registration', ['reg', 'registration']],
  ['authorization', ['auth', 'authorization', 'authorisation', 'maf']],
  ['statement', ['statement', 'stmt']],
  ['financial', ['financial', 'finance', 'fin']],
  ['technical', ['technical', 'tech']],
]);

function wordMatches(word, nameWords) {
  const alts = SYNONYMS.get(word) || [word];
  return alts.some((a) => nameWords.some((w) => w === a || (a.length >= 4 && w.startsWith(a))));
}

export function scoreName(title, fileName) {
  const tw = normalize(title).split(' ').filter((w) => w.length >= 3 && !['and', 'the', 'for'].includes(w));
  const nw = normalize(fileName).split(' ').filter(Boolean);
  if (!tw.length) return 0;
  let hit = 0;
  for (const w of tw) if (wordMatches(w, nw)) hit++;
  return hit / tw.length;
}

// Greedy, deterministic suggestions for unmatched docs and unmatched files.
// Returns [{reqId, fileId, score}]. Skips files with errors and duplicate copies after the first.
export function suggestMatches(requirements, files, matches) {
  const usedFiles = new Set(matches.values());
  const seenHash = new Set();
  for (const fid of usedFiles) {
    const f = files.find((x) => x.id === fid);
    if (f && f.hash) seenHash.add(f.hash);
  }
  const cands = [];
  for (const r of requirements) {
    if (matches.has(r.id)) continue;
    for (const f of files) {
      if (f.error || usedFiles.has(f.id)) continue;
      const s = scoreName(r.title_en, f.name);
      if (s >= 0.5) cands.push({ reqId: r.id, fileId: f.id, score: s, name: f.name, hash: f.hash });
    }
  }
  cands.sort((a, b) => (b.score - a.score) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.reqId < b.reqId ? -1 : 1));
  const out = [];
  const doneReq = new Set();
  for (const c of cands) {
    if (doneReq.has(c.reqId) || usedFiles.has(c.fileId) || (c.hash && seenHash.has(c.hash))) continue;
    doneReq.add(c.reqId); usedFiles.add(c.fileId); if (c.hash) seenHash.add(c.hash);
    out.push({ reqId: c.reqId, fileId: c.fileId, score: c.score });
  }
  return out;
}
