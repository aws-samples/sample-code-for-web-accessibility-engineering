# Validation summary

Final Kiro run on macOS, 2026-10-29. Full raw logs, screenshots, VoiceOver transcripts, reviewer records, and task execution metadata are retained in the internal review package and are not part of the public repository.

| Check | Baseline | Remediated |
| --- | --- | --- |
| Strict Playwright gate | 20 failed / 4 passed (24 total) | 24 passed / 0 failed / 0 skipped |
| axe exploration | 6 rule categories / 27 nodes | 0 rule categories |
| Keyboard exploration | 24 Tab presses, 23 recorded stops; 2 distinct unnamed controls, 4 `(unnamed)` occurrences | 0 unnamed controls |
| Build | exit code 0 | exit code 0 |
| VoiceOver | `SLA RISK` followed by `12.6%` | `SLA RISK` followed by `Increased 12.6%` |

Product-source changes relative to `reference/baseline/` are limited to `src/App.tsx`, `src/styles.css`, and `src/theme.ts`. `src/main.tsx` is unchanged. The 17 source hunks map to the approved requirements.
