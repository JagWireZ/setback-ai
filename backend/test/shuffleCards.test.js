const test = require("node:test");
const assert = require("node:assert/strict");

const { shuffleCards } = require("../dist/backend/engine/helpers/shuffleCards.js");

const STANDARD_SUITS = ["Clubs", "Diamonds", "Hearts", "Spades"];
const STANDARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

test("shuffleCards returns a full 54-card deck", () => {
  const deck = shuffleCards();
  assert.equal(deck.length, 54);
});

test("shuffleCards returns all standard cards exactly once plus both jokers", () => {
  const deck = shuffleCards();

  const jokerCounts = {
    LJ: 0,
    BJ: 0,
  };

  const standardCardKeys = new Set();

  for (const card of deck) {
    if (card.suit === "Joker") {
      assert.ok(card.rank === "LJ" || card.rank === "BJ");
      jokerCounts[card.rank] += 1;
      continue;
    }

    assert.ok(STANDARD_SUITS.includes(card.suit));
    assert.ok(STANDARD_RANKS.includes(card.rank));
    standardCardKeys.add(`${card.rank}-${card.suit}`);
  }

  assert.equal(jokerCounts.LJ, 1);
  assert.equal(jokerCounts.BJ, 1);
  assert.equal(standardCardKeys.size, 52);

  for (const suit of STANDARD_SUITS) {
    for (const rank of STANDARD_RANKS) {
      assert.ok(standardCardKeys.has(`${rank}-${suit}`));
    }
  }
});
