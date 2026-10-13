# Security notes — v1.1

This is a hardened prototype, not a fully cheat-resistant competitive game.

Improvements: request path validation, static-file allowlist, HTTP security headers, same-origin WebSocket upgrade checks, small frame/message limits, rate limits, maximum rooms and clients, stale-room cleanup, numeric score constraints and basic progress validation.

**Remaining risk:** mini-game scores are still computed in the browser. A determined player can modify client behavior. Truly trusted rankings require server-authoritative challenge logic or server-verifiable action streams. No player accounts, moderation, persistent database, or distributed rate limiter are included. Same-origin WebSocket checks protect against ordinary cross-site browser connections, not custom clients.

Render deploy: replace files in GitHub repository root, keep `public/` nested, commit; Render should auto-deploy if enabled. Check the Render logs and test two separate devices.
