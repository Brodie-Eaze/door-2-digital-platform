# Roster — Elevation Report

> `/elevate` dry-run · 2026-06-09 · **Score: 41 / 100**

## Dimension Scores

| Dimension   | Score | Why                                                                                                                                                                                                                                      |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness | 4/20  | `/api/shifts` BFF fully built, never called. All shifts evaporate on page refresh. Week anchor hardcoded May 19 2026. REPS array is a hardcoded constant. Month-view counts are fabricated multipliers                                   |
| Robustness  | 5/20  | 401 treated identically to "no shifts yet." Failed POST leaves permanent ghost shift with temp ID. Failed PATCH swallowed silently. Failed DELETE causes shift to reappear on next navigation. No rollback, no toast, no dirty-flag      |
| Speed       | 18/20 | Genuinely well-designed. Drag-drop updates state synchronously. KPI recomputes in same frame as drag. Only docked for week-navigation race condition + no "saving" indicator                                                             |
| Clarity     | 8/20  | Readable grid. Wrong week (May 19 when it's June 9). QuickAdd accepts "9am" and silently corrupts KPI totals. No save confirmation. "Pushes changes instantly to knocker's iPad" is always visible and always false                      |
| Delight     | 6/20  | Drag animation satisfying (scale-95 rotate-1 on tile, bg-violet-50 ring-2 on target). Rep summary panel with hours and attendance % is a good design. Collapses on ghost shifts, wrong dates, and "Auto SMS sent" badge that did nothing |

**Total: 41 / 100**

---

## Top 8 Recommendations

### #1 — QUICK-WIN · Wire `/api/shifts` — all five mutation paths

**Effort: 1 day. Score delta: +21**

The BFF is fully implemented and correct. Replace all five `setShifts(...)` calls with real API calls: `addShift` → POST, `moveShift` / `updateShift` / `clockOut` → PATCH, `deleteShift` → DELETE. Update state from API response. Replace hardcoded `REPS` constant with `GET /api/users?role=knocker&orgId=...` on mount. Zero new backend work required. The entire value of the roster feature is unlocked.

### #2 — QUICK-WIN · Fix the week anchor + add undo toast on drag-drop

**Effort: 0.5 day. Score delta: +12**

(a) Replace `new Date(2026, 4, 19)` with a dynamic `currentMonday()` — five lines. Every manager who opens the roster today sees the wrong week. (b) After successful `moveShift` PATCH, show toast: "Moved [Rep] · [From Day] → [To Day]. Undo?" with a 6-second `AbortController` window that fires a compensating PATCH if clicked.

### #3 — QUICK-WIN · Surface API errors — loading, error, and stale states

**Effort: 1 day. Score delta: +13**

(a) Replace all `catch(() => {})` and `/* silent */` blocks with `toast.error('Failed to save shift — tap to retry')`. (b) Add `SavingIndicator` chip (spinner → checkmark → error) in grid top-right. (c) On `fetchShifts` 401: redirect to `/login?next={path}` rather than silently falling back to seed. (d) On POST failure: call `setShifts(prev => prev.filter(s => s.id !== optimisticId))` to remove the ghost.

### #4 — MEDIUM · Conflict detection — double-booking and overlap warning inline

**Effort: 1 day**

On drag or add, run `detectConflict(shift, shifts)` — pure function checking: (a) same rep, same day, overlapping time ranges; (b) rep already assigned a different territory on same day. Show red warning banner on target cell before drop confirms. `ConflictBadge` on tile after. Does not block save — warns and lets manager decide. Pure frontend logic, no new API.

### #5 — MEDIUM · Hours-over-limit and fatigue flags

**Effort: 1–2 days**

Configurable thresholds (default: 10h/day, 40h/week, 6 consecutive days). Rep summary column renders amber `⚠ 42h this week` badge. AddShiftModal shows warning: "This puts Jordan Mosley at 44h this week." Not a hard block. The `hoursOf()` and weekly totals are already computed — this is a threshold check on existing state.

### #6 — MEDIUM · Copy last week / template week

**Effort: 2–3 days**

"Copy from last week" button: fetch `GET /api/shifts?weekStart={lastWeekISO}`, strip IDs, set `weekStart` to current week, POST via bulk endpoint. "Copied 47 shifts" toast. "Save as template" stores current week structure as a named template in localStorage keyed to orgId. Saves 20–30 minutes every Monday morning for 50-rep teams.

### #7 — MEDIUM · Territory coverage heat bar in the grid header

**Effort: 2 days**

Row above the 7-day columns: per-day territory coverage summary. "Austin North: 2 of 3 reps · Mon ✓ · Tue ✓ · Wed ⚠ (1 rep) · Thu ✗ (0 reps)." Green/amber/red. Clicking red cell opens AddShiftModal pre-populated with that territory and day. Entirely derivable from existing shift state — no new API call.

### #8 — BIG-BET · Bulk assignment — select N reps, assign to day/territory in one action

**Effort: 4–5 days**

Checkbox select on rep rows (or shift-click multi-select). "Assign selected (N reps)" opens `BulkAssignModal`: pick day, territory, start/end time. Fires `POST /api/shifts/bulk`. "Assigned 18 reps to Austin South · Thursday 09:00–17:00" toast. Secondary surface: "Auto-distribute" — given territory + day, suggest even rep distribution using round-robin. This is the feature that makes the tool work at 200-knocker scale.

---

| #   | Recommendation                               | Type      | Effort | Score Delta |
| --- | -------------------------------------------- | --------- | ------ | ----------- |
| 1   | Wire /api/shifts (all 5 mutations)           | QUICK-WIN | 1d     | +21         |
| 2   | Fix week anchor + undo toast                 | QUICK-WIN | 0.5d   | +12         |
| 3   | Surface API errors + remove ghost on failure | QUICK-WIN | 1d     | +13         |
| 4   | Conflict detection                           | MEDIUM    | 1d     | +11         |
| 5   | Hours-over-limit flags                       | MEDIUM    | 2d     | +7          |
| 6   | Copy last week / templates                   | MEDIUM    | 3d     | +9          |
| 7   | Territory coverage heat bar                  | MEDIUM    | 2d     | +9          |
| 8   | Bulk assignment                              | BIG-BET   | 5d     | +9          |

**QW-1 + QW-2 + QW-3 (2.5 days total): 41 → ~87.** Everything after is competitive differentiation.
