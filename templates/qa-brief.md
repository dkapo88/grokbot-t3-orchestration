<!-- QA child brief, sent by the implementer via delegate-task. -->
QA branch {{branch}} at head {{sha}} in {{path}} ({{preview URL or how to run locally}}).

Test plan:
1. {{changed flow}}: {{steps}} -> {{expected}}
2. {{critical path it touches}}: {{steps}} -> {{expected}}

Guardrails:
- Screenshots only to prove an assertion, about 25 max, no repeats of unchanged screens.
- Stop at the first blocking failure; report it with evidence and wait.
- On a re-run, retest only the failed checks and the flows the fix touched.
- Stop and report what's left at about 150 requests.
- Use seeded test accounts named in {{doc}}. Never print passwords or tokens.
- Clean up: stop servers and simulators you started, delete evidence after reporting it.

Report: pass or fail per step, evidence links, anything not tested.
