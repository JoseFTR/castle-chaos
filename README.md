# CASTLE CHAOS!

A 2–8 player real-time Japanese obstacle game-show-inspired browser party game. Original game identity and artwork styling; no affiliation with Takeshi’s Castle.

## Start on your Mac
1. Install Node.js 18+ (you already did if the previous game ran).
2. Open Terminal. Type `cd ` (with a trailing space), drag the extracted **castle-chaos** folder into Terminal, and press Return.
3. Type `node server.js` and press Return.
4. Open **http://localhost:3000** in Chrome.
5. Create an arena; join from another tab using the six-character code.

If you see `EADDRINUSE`, stop the older game server in its Terminal window with Control+C first.

## Rules
10 stages. Each player rolls a fair independent six-sided die and advances around a 24-space board. Landing spaces grant Glory, remove Glory, grant a Golden Crown (costing 20 Glory), award a supply crate, or trigger a trap. Highest die roll gets +15 Glory; tied highest rollers get +10 each. Each stage ends with a randomly selected shared skill challenge. All four challenges appear once per shuffled cycle before any repeats, and the same challenge never appears in back-to-back stages: Foam Frenzy (tap targets), Bridge of Doom (timing), Boulder Panic (dodge), or Ninja Memory (repeat symbols). Challenge placement earns +30/+20/+10/+5 Glory. Golden Crowns add 50 points at the finale.

## Testing status
Core two-player game flow is testable locally. Game scoring is client-reported and should not be treated as cheat-proof. Room state is held in memory and disappears on server restart. Internet play requires hosting the Node server on an accessible host.

## Random mini-game rotation
The server uses cryptographic random selection to shuffle a four-game deck. Each mini-game is played once before the deck reshuffles, and consecutive repeats are prevented. Rematches start with a fresh shuffled deck.
