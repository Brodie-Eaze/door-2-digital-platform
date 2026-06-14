# Run "Knocker iOS" on your physical iPhone (demo)

The app talks to the API running on your Mac. Phone + Mac must be on the **same Wi-Fi**.

## Already set up for you
- API binds `0.0.0.0:3010` (LAN-reachable) and is running.
- App API URL is pointed at your Mac's LAN IP: **`http://192.168.20.103:3010/v1`** (in `Info.plist`).
- Demo logins (password for all: `Knock!Test123`):
  - **`rep-hope@d2d.io`** — knocker @ *Hope Forward* (charity): Cherrywood East area + Hope giving tiers + shifts.
  - **`rep-pest@d2d.io`** — knocker @ *PestMax* (commercial): Lakewood Heights area + pest plans.
  - `mgr-hope@d2d.io` — manager (for the web operator console).

## Steps
1. **Same Wi-Fi** — put the iPhone on the same network as the Mac.
2. **Keep the API up** — if it's not running:
   `cd ~/D2D/door-2-digital-platform/apps/api && pnpm dev`
   Test from the phone's Safari: `http://192.168.20.103:3010/v1/healthz` → should return `{"status":"ok",...}`.
3. **Connect the iPhone** to the Mac by cable → unlock → tap **Trust This Computer**.
4. **Open the project**:
   `open ~/D2D/door-2-digital-platform/apps/knocker-ios/D2DKnocker.xcodeproj`
5. **Signing**: select the `D2DKnocker` target → **Signing & Capabilities** →
   - Tick **Automatically manage signing**.
   - **Team** = your personal Apple ID (add it in Xcode → Settings → Accounts if needed — a *free* Apple ID works).
   - If the bundle id `io.d2d.knocker` conflicts, change it to e.g. `io.d2d.knocker.brodie`.
6. **Pick your iPhone** in the device dropdown (top bar) and press **Run ▶**.
7. On the phone, the app installs but is **untrusted** → Settings → **General → VPN & Device Management** → tap your Apple ID under *Developer App* → **Trust**.
8. Open **Knocker iOS** → log in as **`rep-hope@d2d.io` / `Knock!Test123`**.
9. You'll see Hope Forward's real **area** (Cherrywood polygon — no fake houses), its **catalog**, and **shifts**. Knock a door, take a photo, sign a donor up → it pushes to the platform; watch it appear in the web operator console for that account.

## Gotchas
- **IP changed?** If the Mac's Wi-Fi IP changes (DHCP), update the host in `Info.plist` `D2D_API_BASE_URL` and rebuild. Find the current IP: `ipconfig getifaddr en0`.
- **"No connection" on login** → phone + Mac not on same Wi-Fi, API not running, or stale IP. Re-check step 2.
- **App expires after 7 days** with a free Apple ID — just re-Run from Xcode to refresh. A paid Apple Developer account ($99/yr) + **TestFlight** removes the limit and lets your team install over-the-air (no cable).
- **Switch tenants**: sign out, log in as `rep-pest@d2d.io` to see the *other* tenant's area/catalog — proof the same app is multi-tenant.
