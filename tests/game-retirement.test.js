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
    assert.doesNotMatch(content, /(?:href=["']\/game(?:[?"'])|formularacingcamp\.com\/game\b)/i, `${file} still advertises /game`);
  }
});

test('retired launch game remains available but explicitly unindexed', () => {
  const game = read('game.html');
  const leaderboard = read('game-leaderboard.html');
  const vercel = JSON.parse(read('vercel.json'));
  const robotHeaders = new Map(
    vercel.headers.map((rule) => [
      rule.source,
      rule.headers.find((header) => header.key.toLowerCase() === 'x-robots-tag')?.value
    ])
  );

  assert.match(game, /<meta name="robots" content="noindex, nofollow">/i);
  assert.match(leaderboard, /<meta name="robots" content="noindex, nofollow">/i);
  assert.equal(robotHeaders.get('/game'), 'noindex, nofollow');
  assert.equal(robotHeaders.get('/game-leaderboard'), 'noindex, nofollow');
});
