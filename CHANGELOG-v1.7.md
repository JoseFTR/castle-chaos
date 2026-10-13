# Castle Chaos v1.7 - Scoring visibility and verification

- Results show each player's Glory before the mini-game, awarded Glory, and new Glory total.
- The server sends authoritative score breakdowns with every result.
- Automated integration tests verify that awarded Glory matches the leaderboard on both connected clients for all ten rounds.
- This update does not change existing reward values or skill-game rules.

If your live game still shows 100 for both players, confirm Render deployed the latest commit and hard-refresh the browser.
