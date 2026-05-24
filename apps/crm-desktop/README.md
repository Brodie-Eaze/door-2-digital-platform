# apps/crm-desktop

**CRM / Inside-Sales Desktop** — full-screen workstation for call-centre reps. Pop-out window with 3-column DialerCockpit (queue · script + customer · notes/CRM).

Phase 0 placeholder. Phase 1.3+ implementation:

- Lead queue with filter + auto-dial mode
- DialerCockpit: Aircall integration (Twilio Voice migration Phase 4)
- Script viewer with branching (pitch markdown rendered)
- Sequence designer DAG (call → SMS → email → wait → condition)
- Pipeline kanban with drag-drop stage moves
- Real-time call-status updates via Ably channel `org:<id>:user:<id>:calls`

Could also live as `apps/web-org/src/app/inside-sales/dialer/[sessionId]` — split decision deferred to Phase 1.3.
