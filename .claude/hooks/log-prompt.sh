#!/usr/bin/env bash
# UserPromptSubmit hook: append the user's prompt to PROMPT.md. Never blocks, never prints.
{
  DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  INPUT="$(cat)"
  HOOK_INPUT="$INPUT" HOOK_DIR="$DIR" python3 - <<'PY'
import json, os, re, datetime
try:
    d = os.environ["HOOK_DIR"]
    prompt = json.loads(os.environ.get("HOOK_INPUT") or "{}", strict=False).get("prompt") or ""
    t = prompt.strip()
    skip = ("<agent-message", "<task-notification", "<system-reminder", "<local-command", "<command-name")
    if t and not t.startswith(skip):
        path = os.path.join(d, "PROMPT.md")
        existing = ""
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                existing = f.read()
        n = len(re.findall(r"^## #[0-9]+", existing, re.M)) + 1
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        sep = "" if existing == "" or existing.endswith("\n\n") else ("\n" if existing.endswith("\n") else "\n\n")
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{sep}## #{n} — {ts}\n\n{prompt}\n\n")
        os.makedirs(os.path.join(d, ".claude"), exist_ok=True)
        with open(os.path.join(d, ".claude", "last_prompt.txt"), "w", encoding="utf-8") as f:
            f.write(prompt)
except Exception:
    pass
PY
} >/dev/null 2>&1
exit 0
