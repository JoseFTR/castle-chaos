const crypto = require('crypto');
const GAMES = Object.freeze(['tap', 'stop', 'dodge', 'memory']);
function shuffled(excludeLast) {
  const result = [...GAMES];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (excludeLast && result[0] === excludeLast) {
    const swap = 1 + crypto.randomInt(result.length - 1);
    [result[0], result[swap]] = [result[swap], result[0]];
  }
  return result;
}
function nextGame(room) {
  if (!room.gameQueue || room.gameQueue.length === 0) room.gameQueue = shuffled(room.lastGame);
  const selected = room.gameQueue.shift();
  room.lastGame = selected;
  return selected;
}
module.exports = { nextGame, shuffled, GAMES };
