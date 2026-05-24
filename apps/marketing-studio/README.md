# apps/marketing-studio

**AI Marketing Studio** — brief → generate (Claude/FLUX/Runway) → preview → approve → deliver (Meta/Google/TikTok).

Phase 0 placeholder. Lands in Phase 3 (Week 25–32). See plan §10.

Backend service: `apps/api/src/domains/content-studio/` + `apps/api/src/domains/marketing/`. Worker: `worker:content-generate` + `worker:ad-deliver`.

Brand-safety stack required before publish:
1. Anthropic moderation API on every copy string
2. Custom rule engine per vertical/jurisdiction
3. Legal-hold flag → block + route to `legal.review`
4. Image safety (Sightengine) + logo collision
5. Video safety (frame sampling + transcription check)

All AI outputs carry C2PA provenance manifests. Cost capped at `Org.aiBudgetCents` with PagerDuty anomaly alerts on burn-rate.
