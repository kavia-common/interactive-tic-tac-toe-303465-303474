import { createChatCompletion, getOpenAIApiKey } from "../lib/openaiClient";

/**
 * Small, tasteful fallback quips (PG-rated).
 * Keep them short and playful.
 */
const FALLBACK_QUIPS = [
  "Bold move. Let’s see if it pays off.",
  "Nice placement—confidence looks good on you.",
  "Ooh, spicy. The board felt that one.",
  "You’re playing like you’ve read the manual.",
  "That square was lonely anyway.",
  "Interesting… very interesting.",
  "Clean move. Almost too clean.",
  "Respect. But I’m not worried. Yet.",
  "You call that strategy? I call it ‘ambitious.’",
  "I’ve seen better… but I’ve also seen worse.",
];

const MOVE_FALLBACK_QUIPS = [
  "Alright, alright—making it interesting.",
  "A move with vibes. I’ll allow it.",
  "Calculated… or just lucky?",
  "You’re really committing to that idea, huh?",
];

const WIN_FALLBACK_QUIPS = [
  "GG! That was smooth.",
  "Winner energy detected. Nicely done.",
  "You earned that one—respect.",
  "Okay, that was actually impressive.",
];

const DRAW_FALLBACK_QUIPS = [
  "A draw. Perfectly balanced—like a boring masterpiece.",
  "Nobody wins. Everybody gets snacks.",
  "Draw game. The board remains unconquered.",
  "Stalemate! That was oddly poetic.",
];

/**
 * In-memory cache for common situations during a session.
 * key: `${event}:${hash}`
 */
const cache = new Map();

/**
 * PUBLIC_INTERFACE
 * Create a stable hash for a 3x3 board plus small context.
 * @param {Array<"X"|"O"|null>} boardState
 * @param {string} currentPlayer
 * @param {number|null|undefined} lastMoveIndex
 * @param {"move"|"win"|"draw"} event
 * @param {"X"|"O"|undefined} winner
 * @returns {string}
 */
export function hashTrashTalkContext(
  boardState,
  currentPlayer,
  lastMoveIndex,
  event,
  winner
) {
  // Board string: X/O/-
  const b = (boardState || [])
    .map((v) => (v === "X" ? "X" : v === "O" ? "O" : "-"))
    .join("");
  return `${event}|p:${currentPlayer || "-"}|m:${
    Number.isInteger(lastMoveIndex) ? lastMoveIndex : "-"
  }|w:${winner || "-"}|b:${b}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getFallbackForEvent(event) {
  if (event === "win") return pickRandom(WIN_FALLBACK_QUIPS);
  if (event === "draw") return pickRandom(DRAW_FALLBACK_QUIPS);
  if (event === "move") return pickRandom(MOVE_FALLBACK_QUIPS);
  return pickRandom(FALLBACK_QUIPS);
}

function shouldWarnDev() {
  return process.env.REACT_APP_NODE_ENV !== "production";
}

/**
 * PUBLIC_INTERFACE
 * Generate a short, PG-rated trash talk quip for the given context.
 * Includes in-memory caching; falls back gracefully on failures or missing key.
 *
 * @param {{
 *  boardState: Array<"X"|"O"|null>,
 *  currentPlayer: "X"|"O",
 *  lastMoveIndex: number,
 *  event: "move"|"win"|"draw",
 *  winner?: "X"|"O"
 * }} context
 * @returns {Promise<string>}
 */
export async function generateTrashTalk(context) {
  const apiKey = getOpenAIApiKey();
  const hash = hashTrashTalkContext(
    context.boardState,
    context.currentPlayer,
    context.lastMoveIndex,
    context.event,
    context.winner
  );
  const cacheKey = `${context.event}:${hash}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // No key => no API calls, just fallback.
  if (!apiKey) {
    if (shouldWarnDev()) {
      // eslint-disable-next-line no-console
      console.warn(
        "[trashTalk] REACT_APP_OPENAI_API_KEY is missing; using fallback quips."
      );
    }
    const q = getFallbackForEvent(context.event);
    cache.set(cacheKey, q);
    return q;
  }

  // Minimal prompt with constraints.
  const boardPretty = (context.boardState || [])
    .map((v, i) => `${i}:${v || "-"}`)
    .join(" ");

  const system = [
    "You are a playful, PG-rated commentator for a Tic Tac Toe game.",
    "Write a short one-liner (1–2 sentences max).",
    "No profanity, no insults about protected traits, no harassment.",
    "Keep it light, witty, and friendly.",
    "Avoid mentioning 'OpenAI' or model names.",
    "Do not use more than 180 characters.",
  ].join(" ");

  const user = [
    `Event: ${context.event}`,
    context.event === "win" ? `Winner: ${context.winner}` : "",
    `Current player (next to move): ${context.currentPlayer}`,
    `Last move index: ${context.lastMoveIndex}`,
    `Board: ${boardPretty}`,
    "Give a playful quip reacting to the current moment.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await createChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.9,
      max_tokens: 60,
    });

    // Hard trim to keep UI tidy.
    const cleaned = String(text).replace(/\s+/g, " ").trim().slice(0, 200);
    const finalText = cleaned || getFallbackForEvent(context.event);

    cache.set(cacheKey, finalText);
    return finalText;
  } catch (err) {
    if (shouldWarnDev()) {
      // eslint-disable-next-line no-console
      console.warn("[trashTalk] OpenAI call failed; using fallback.", err);
    }
    const q = getFallbackForEvent(context.event);
    cache.set(cacheKey, q);
    return q;
  }
}
