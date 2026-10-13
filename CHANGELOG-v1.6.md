# Castle Chaos v1.6 - Stability update

## Fixes
- All-zero mini-game results award only 5 participation Glory to connected players, instead of incorrectly granting first place to everyone.
- Disconnected players receive zero mini-game Glory and are not ranked ahead of connected players.
- Ninja Memory mistakes reset sequence progress but do not decrease the already-submitted score; this keeps the client consistent with the server's monotonic score validation.
- In Host's Choice, if no challenge is chosen within 20 seconds, the server automatically chooses the next shuffled challenge. This also covers host disconnections.
- Rooms with no connected players are kept for 60 seconds so clients can reconnect before the room is removed.
- Finale rankings use the same crown tie-break as the champion calculation.
- Results show Glory awarded for each mini-game.

## Testing
Run `node tests/integration.js` from the extracted project folder. This test uses temporary accelerated timers in a spawned local server, and exercises 10 rounds with 2 simulated WebSocket players, game rotation, scores, finale, reconnect, host transfer, selection fallback, all-zero scoring, and disconnected-player rewards.

## Limitations
- The full visual experience, phone touch interactions, and sound still need hands-on browser testing.
- Mini-game scores are still reported by the client; this update does not make cheating impossible.
- Active rooms are held in memory and are lost when Render restarts the server.
- Room reconnect grace is 60 seconds only while the server remains running.
