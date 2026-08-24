# AIPrep365 — Application Change Log

**File:** `CHANGELOG.md`
**Purpose:** Track every application change, bug fix, UI change, feature, improvement, and pending task in one central place — instead of scattered across chats, screenshots, and task messages.

## How to use this file

- Newest entries go at the top, grouped by date (`YYYY-MM-DD`).
- Each line is one change: a short **tag**, what changed, and (for bug fixes) the root cause in one clause — not just the symptom.
- Tags: `[Bug Fix]` `[UI]` `[Feature]` `[Improvement]` `[Backend/Data]` `[Docs]`
- Reference the commit hash where one exists, so the entry links back to the actual diff.
- Keep **Pending / Known Issues** below up to date — move an item into the dated log (with the commit that resolved it) once it ships, instead of deleting the history of it having been a problem.
- This file is the source of truth for "did X ship yet, and why was it changed" — prefer updating it over re-explaining a fix in chat.

---

## Pending / Known Issues

- **Legacy DOCX-imported questions have no `question_number`.** The parser/upload pipeline now stamps every newly-imported question with its source-order number (commit `6531c21`), but the ~10,700 questions imported *before* that fix still have `question_number = NULL`. They still display and sort correctly (falling back to `id` order), just without their original Word-document number shown. No bulk backfill has been run — would need to be done deliberately if wanted, since it touches all existing rows.
- **Broader mobile/performance audit deferred.** The 2026-08-14 work (`f036160` and related) was explicitly scoped to "targeted fixes first" (Tutor dashboard, Student My Courses) rather than a full page-by-page audit across Admin/Tutor/Student/Parent. A general audit was agreed to happen later, on request.
- **Character-substitution bugs (γ/gamma, "times"→"X") are fixed at the render layer, not the data layer.** `MathRenderer`'s over-eager LaTeX-recovery heuristic (fixed in `cdf5fb7`) no longer *corrupts* text on display, but any already-saved question text that was hand-edited through the previously-broken admin editor may still contain corrupted content baked into the database. Not retroactively repaired — flagged if a specific bad question turns up.

---

## 2026-08-18

- **`a491bf6`** `[UI]` **[Bug Fix]** Leaderboard Top 5 podium redesign: dropped the fixed "podium elevation" card heights that made rank 1–3 look oversized at real 100% browser zoom; replaced faint gradient tints with clearly distinct solid gold/silver/bronze coloring so 1 > 2 > 3 reads at a glance; lightened medal badge backgrounds so the 🥇🥈🥉 emoji are actually legible. Fixed rank #4/#5 mini-cards showing `#4` twice when two students tie on score (was labeling by tied rank instead of list position). Fixed the score text (`400 / 1600`) wrapping onto a second line by giving the score `whitespace-nowrap flex-shrink-0` and letting the name truncate instead.
- **`142ff77`** `[Bug Fix]` **[UI]** **[Backend/Data]** Combined fix batch:
  - Exam question interface: `MathRenderer` now distinguishes a real paragraph break (blank line in source) from a simple line wrap, so multi-paragraph passages (e.g. Cross-Text Connections "Text 1 / Text 2") don't render as one cramped block. Removed conflicting `prose`/`whitespace-pre-wrap` classes in `PracticeQuizUI` that were fighting with `MathRenderer`'s own line-break handling.
  - Finish button: was giving zero visual feedback while the submission saved and stayed clickable, allowing accidental double-submission. Added a "Finishing…" disabled state and a re-entrancy guard in `handleFinishQuiz`.
  - Test History & Review: combined SAT topic cards and individual attempt cards (ACT/AP/Full-Length) were rendered as two separate fixed blocks (combined always first), so a newly-completed ACT/AP/Full-Length attempt could never reach the top of the page. Merged into one list sorted by actual completion timestamp. Collapsed duplicate individual-attempt cards for topics that already have a combined card. Restyled individual cards to match the combined card's design exactly (this also fixed a button-row CSS overflow bug) and dropped score-based red/orange coloring in favor of one consistent blue theme, per explicit design request.
  - **Leaderboard scoring root-cause fix:** `grading.js`'s `/universal-leaderboard` classified a submission as "SAT Math" vs "SAT Reading & Writing" purely by checking whether the course name contained the word "math" — Full-Length Test submissions (whose names never contain "math") were silently being counted as R&W attempts, contaminating SAT Overall/Math/R&W rankings. Verified against real data: Full-Length Test scaled scores (1, 7, 21, 24, 73) were being folded into a student's R&W score pool. Replaced with a reliable classifier based on `main_category`/`tutor_type`/`is_adaptive` (same convention used elsewhere in the app). Topic/Subtopic categories now match exactly on `courses.category`/`courses.name` instead of loose substrings. SAT Overall no longer fabricates a missing Math or R&W half with a default `400` — a student isn't ranked for "SAT Overall" until both halves are actually complete.
- **`d88375c`** `[Bug Fix]` Question editing was silently failing to save: `QuestionForm` submitted `formData.courseId` (camelCase) directly to Supabase, but the `questions` table column is `course_id` (snake_case) — PostgREST rejected the whole update (`PGRST204`), so **no edit-save on an existing question was ever actually persisting**, and the failure was invisible until the same-day fix below started surfacing `{error}` instead of swallowing it. Also fixed the same mismatch in `QuestionCard` (`question.courseId`/`question.uploadId`), which was why cards always showed "Unknown Course" / "Manual Entry" regardless of the real data.

## 2026-08-17

- **`6531c21`** `[Feature]` **[Bug Fix]** Admin Questions page now displays and orders questions by their original source-document sequence instead of database insertion order. Parser captures each question's literal printed number (e.g. "Q.26)" → 26) with a parse-order fallback for documents with no explicit numbering; stored in the previously-unused `question_number` column. Since that column is text (not integer), sorting is done numerically client-side to avoid `"10"` sorting before `"2"`. Also fixed the Edit Question workflow: Preview and Save now read each rich-text editor's live content via a ref instead of depending on the editor's `blur` event having already fired (was dropping the very last edit in some cases), and `questionService.update`/`.create` errors (which Supabase returns as `{error}`, never throws) are now surfaced instead of silently ignored — a second, independent cause of "my edit didn't save."
- **`ae453b3`** `[UI]` **[Bug Fix]** Admin Users and Demo Leads tables were unusable at real 100% browser zoom — the rightmost Actions column required horizontal scrolling to reach. Trimmed padding/min-widths and made the action column `sticky right-0` so it's always reachable. Added dynamic summary cards: Users page shows live Student/Tutor/Parent/Admin totals; Demo Leads shows Total Students / by Test / by Grade / by Status, reactive to the active filters (added a Grade filter that didn't exist before).
- **`cdf5fb7`** `[Bug Fix]` DOCX content fidelity, three independent root causes found and fixed:
  1. A "broken LaTeX recovery" heuristic in `MathRenderer` was rewriting plain English words — `gamma`, `times`, `alpha`, `beta`, `theta` — into LaTeX commands whenever followed by whitespace, which MathJax then rendered as Greek letters/math symbols (`"gamma ray"` → rendered as `"γ ray"`; `"3 times"` → rendered as `"3×"`, reported as `"3X"`). Reproduced and confirmed both exact symptoms before/after the fix. Scoped the recovery to only fire when a structural command (`frac`/`sqrt`/`text`) is immediately followed by an argument bracket — never valid English.
  2. Admin Question editor accepted only one character at a time / lost cursor focus after backspace: the four Jodit rich-text editors fed their own `value` back through `onChange` on every keystroke, and `jodit-react` force-resets its internal DOM whenever the `value` prop changes — confirmed in the library's own source. Switched to `onBlur`.
  3. Bulleted/numbered lists in source DOCX files were being silently flattened into plain-text lines during parsing (no `<w:numPr>` handling at all). Parser now reads `word/numbering.xml` and rebuilds real, correctly-nested `<ul>/<ol><li>` HTML, verified end-to-end against a real production DOCX.
- **`bbc69a6`** `[UI]` **[Bug Fix]** Redesigned the Student Groups page and AI Companion UI per explicit "UI only, don't touch functionality" instructions. AI Companion: added a working back button (two-stage: mid-conversation reset vs. navigate away), a functioning microphone/speech-to-text button (fixed a transcript-duplication bug caused by appending each `onresult` callback instead of rebuilding from a snapshot), and removed the Premium-only restriction on topic practice per instruction (both plans now get full access, quiz count is a suggested/editable prefill rather than an immediate auto-send). Exam typography: wired the already-loaded Inter font into Tailwind's `font-sans` stack (it was loaded via Google Fonts but never actually applied, silently falling back to the OS system font — the real cause of "text too thin/small"). DOCX parser: widened the option-extraction regex to handle a question stem ending directly against an option letter with no space (`"...phrase?A)theory"`).

## 2026-08-16

- **`106eda8`** `[Bug Fix]` **[Improvement]** Universal leaderboard: fixed a crash from undefined variables, replaced fragile Full-Length/AP heuristics with proper `main_category`/`is_adaptive` checks, fixed group/assignment scoping, added assigned/completed/highest/average stats. Demo Leads: normalized email matching so the "latest submission" logic actually finds duplicates, refreshed `created_at` on update, added Test Type/Specific Test/Status/Search filters. Parallelized independent Supabase queries across student/tutor dashboards (measured 433ms→132ms on one dashboard). Fixed a Supabase 1000-row default-cap bug in KB topic matching and course question-counts that was silently truncating data.
- **`8b07c81`** `[Feature]` Added hierarchical group analytics and the first version of the universal shared leaderboard (student/tutor/admin/parent).

## Earlier history (pre-changelog)

*Summarized from commit messages only — no detailed root-cause context recorded before this file was created.*

- `7b8cf8f` (2026-08-14) — Fix Demo email parent dispatch to use single call
- `a0fbe9f` (2026-08-14) — Update Demo report PDF generation and email logic
- `9b3d1c0` (2026-08-14) — Fix text visibility in short answer input field
- `f036160` (2026-08-14) — UI redesigns for Practice Quiz, AI Tutor modal, sidebar feedback removal, and level dashboard updates
- `c6cbabd` (2026-08-12) — Fix nested routing unmounts in App.jsx by grouping routing keys to prevent layout jumps
- `4a1e528` (2026-08-12) — Fix AITutorAgent unmount crash by preventing useEffect from returning scrollIntoView result
- `9eb3757` (2026-08-12) — Fix test_submissions queries crashing due to non-existent status column
- `d57a4be` (2026-08-12) — Fix sidebar scroll resetting on route change
- `0480f24` (2026-08-12) — Optimize test_submissions queries to fix slow loading pages
- `8e24c80` (2026-08-11) — Fix UI zoom issues and PDF print clipping
- `da7e985` (2026-08-11) — Linear SAT student flow, file deletion fix, dynamic card status & report titles
- `e9d8645` (2026-08-11) — Enhance Weakness Drills filters, Student Course List buttons & background consistency, and Test Review real-time scores for all test types
- `6e3986b` (2026-08-10) — Redesign Level Selection and Level Dashboard UI
- `c7e6e13` (2026-08-10) — UI enhancements for file uploads and sidebars
- `ef53929` (2026-08-10) — Update Full Length Test UI and implement Linear SAT scoring tables
- `bde0749` (2026-08-10) — Complete Admin Dashboard UI upgrade and Linear SAT scoring
- `cf8c141` (2026-08-07) — Fix Admin Dashboard data integration and UI enhancements
- `e6ccffe` (2026-08-07) — Enhance Demo Landing Page, Demo Leads filters, and Demo Test Report logo
- `87d6e2e` (2026-08-06) — Implemented Jodit custom Math plugin, updated Demo Test UI for naming/branding, and improved course module views
- `c45d808` (2026-08-05) — Enhance demo leads report viewing and save submission analytics
- `b0bc874` (2026-08-01) — Handle PGRST204 error for undefined columns during group update
