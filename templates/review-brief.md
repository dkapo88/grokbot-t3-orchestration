<!-- Review child brief, sent by the implementer via delegate-task. -->
Review the diff of branch {{branch}} against {{base}} at head {{sha}} in {{path}}.
{{For a re-review: only the commits after {{last reviewed sha}}.}}

Rules:
- Read-only. Use only read, grep, find, ls and git (via bash). No edits, commits, pushes, PR comments or network installs.
- Focus on correctness, security, data loss, edge cases, and whether the acceptance criteria are met: {{criteria}}.
- Report findings as a numbered list: severity (blocker, major, minor, nit), file and line, the problem, a suggested fix.
- If everything is fine, say "No blocking findings" and list anything you couldn't check.
