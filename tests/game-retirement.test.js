const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('retired launch game is absent from public discovery surfaces', () => {
  for (const file of ['index.html', 'puzzles.html', 'llms.txt', 'llms-full.txt', 'sitemap.xml']) {
    const content = read(file);
    assert.doesNotMatch(content, /(?:href=["']\/game(?:[?"'])|formularacingcamp\.com\/game(?=[/?#"\s<]|$))/i, `${file} still advertises /game`);
  }
});

test('retired game has no pages, submission APIs or current leaderboard records', () => {
  for (const file of ['game.html', 'launch-game.js', 'game-leaderboard.html', 'game-leaderboard.js', 'launch-game.css', 'api/launch-game-submit.js', 'api/launch-game-leaderboard.js', 'data/launch-game-leaderboard.json']) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must stay retired`);
  }
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(!vercel.redirects.some(rule => ['/game.html', '/game-leaderboard.html'].includes(rule.source)));
  const counters = require('../lib/analytics-counters');
  const safe = require('../lib/public-analytics');
  assert.ok(!counters.ACTION_DEFINITIONS.some(action => action.key === 'discount_game_submitted'));
  assert.equal(counters.incrementSubmission, undefined);
  assert.equal(safe.publicPath('/game'), null);
  assert.equal(safe.publicPath('/game-leaderboard'), null);
  // Preserve the source-file block in case an old file is accidentally restored.
  assert.ok(vercel.rewrites.some(rule => rule.source === '/data/launch-game-leaderboard.json' && rule.destination === '/api/not-found'));
});
