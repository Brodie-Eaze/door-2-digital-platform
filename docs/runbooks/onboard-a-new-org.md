# Runbook — Onboard a new client org (charity or business)

> **Audience:** any operator, no engineering required. This is the D11 procedure:
> take a brand-new charity or business from "signed" to "their team logging real
> knocks in the field", entirely through the UI. Every step below was executed
> against production on 2026-08-21 (org: Northside Trust) and verified.
>
> **You need:** a super_admin login to the Command Centre. Nothing else.

---

## 1. Create the org + its first admin (2 minutes)

1. Sign in to the **Command Centre** (operator console) as a super_admin.
2. Top right → **Onboard new business**.
3. Fill the wizard:
   - **Business profile:** legal name, trading name, vertical (charity /
     commercial / healthcare), region (US / AU / SG — this is **locked forever**
     at create, pick correctly), and the **primary contact** (name + email).
     That contact becomes the org's first admin.
   - **Brand kit, plan, field team:** set or accept defaults.
4. **Activate.** The org is created and — in the same step — a **founding admin
   invite** is minted for the primary contact.
5. A one-time **invite card** appears. **Copy it now** — it is shown once and is
   never stored. Send it to the admin (the link, or the token). It expires in 7
   days.

> What just happened underneath: the org, its brand kit, its billing config, an
> `org_admin` user (status `invited`), and the audit row were all written in one
> atomic transaction. The org is fully tenant-isolated from every other org from
> this instant.

---

## 2. The admin activates their account (admin does this, 1 minute)

1. The admin opens the invite link → the **Org console** `/accept-invite` page.
2. They set a password (min 8 chars) and confirm.
3. They are signed straight into their own **Org console** — which shows only
   their org's data (empty at first, which is correct).

---

## 3. Map the first territory + invite a knocker (admin, 3 minutes)

Inside the Org console:

1. **Territories** → draw / add the first area to knock. (Areas, not per-house
   pins — D2D is a data company; pins leak.)
2. **Knockers / Team** → invite a field rep by email. A one-time knocker invite
   token appears — send it to the rep.
3. **Assign** the rep to the territory.

---

## 4. The knocker goes live (rep does this, 2 minutes)

1. The rep installs **Knocker iOS** (or opens it if pre-installed).
2. They open their invite link once to set a password, then sign in **in the
   app** with that email + password.
3. The app shows their **assigned area** (pulled live from the platform).
4. They start a shift and log knocks. Each knock flows back to the platform in
   real time and appears in the Org console + the operator's Command Centre —
   scoped to this org only.

---

## Verification (operator, anytime)

- Command Centre → the new account tile shows its live knocker count, leads, and
  MTD figures (all zero until the first field activity, which is honest).
- The org admin sees their own knocks; **no other org can see them** (enforced at
  the Postgres RLS belt, not just the app — 33 adversarial isolation tests cover
  this).

## If something goes wrong

| Symptom                                           | Fix                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Invite link says "invalid or expired"             | Tokens are single-use + 7-day. Re-invite from the Team screen (org admin) or re-run the wizard's admin step (super_admin).          |
| Admin can't log in after setting password         | Confirm they used the **email the org was created with** — the login keys on it.                                                    |
| Knocker sees "No territory assigned yet"          | The admin must **assign** them to a territory (step 3.3), not just invite them.                                                     |
| App shows the login screen only / can't reach API | Check the app build points at the production API (Release config `D2D_API_BASE_URL`); confirm the API `/v1/readyz` returns `ready`. |

That is the whole loop: **signed → org live → admin in → area mapped → rep in the
field → real knocks in the platform**, with no engineer in the path.
