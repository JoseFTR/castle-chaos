# Castle Chaos v1.4 — Collision + Mini-game Variety

- Boulder Panic uses pixel-space circular collision tests centered on the ninja and boulder, instead of a broad horizontal proximity threshold.
- Corrects player position mapping and centers the boulder artwork.
- Adds Samurai Signal (reaction timing), Golden Catch (moving target tapping), and Taiko Beat (rhythm timing).
- Seven games rotate through a shuffled bag with no repeats until all seven have appeared.
- Keeps existing room codes, server protections, sound system, and visual theme.

## Testing
Run `node --check server.js` and `node --check public/client.js`, then `node server.js`. Test on phone and desktop before broad release. Scores are still browser-reported and not cheat-proof.
