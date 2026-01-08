import { createChatCompletion, getOpenAIApiKey } from "../lib/openaiClient";

/**
 * Tone presets supported by the UI.
 * (Kept here too so the service can validate/sanitize inputs.)
 */
const TONES = /** @type {const} */ ([
  "Playful",
  "Competitive",
  "Snarky",
  "Encouraging",
]);

/**
 * Frequency presets supported by the UI.
 * Note: service doesn't decide whether to trigger; App does.
 * We still accept/pass it as context so the LLM can optionally acknowledge cadence.
 */
const FREQUENCIES = /** @type {const} */ ([
  "Key events only (win/draw)",
  "Every 2 moves",
  "Every move",
]);

/**
 * Tone guideline snippets for the system prompt.
 * Keep them PG-rated, friendly, concise.
 */
const TONE_GUIDELINES = {
  Playful:
    "Tone: Playful. Be light, witty, and friendly—like a fun sports commentator.",
  Competitive:
    "Tone: Competitive. Confident, match-focused hype. Keep it sportsmanlike and friendly.",
  Snarky:
    "Tone: Snarky. Dry humor and gentle teasing about the move itself (not the person). Keep it kind and PG.",
  Encouraging:
    "Tone: Encouraging. Positive, supportive, and motivational—celebrate good effort and suggest confidence.",
};

/**
 * Small, tasteful fallback quips (PG-rated) per tone.
 * Keep them short and friendly. These are used if:
 * - REACT_APP_OPENAI_API_KEY is missing, or
 * - the OpenAI request fails for any reason.
 */
const FALLBACK_QUIPS_BY_TONE = {
  Playful: [
    "Bold move. Let’s see if it pays off.",
    "Nice placement—confidence looks good on you.",
    "Ooh, spicy. The board felt that one.",
    "Interesting… very interesting.",
    "Clean move. Almost too clean.",
  ],
  Competitive: [
    "Alright—gloves off. Let’s play.",
    "That’s a statement move. I respect it.",
    "You’re bringing heat—good.",
    "Pressure’s on. Next move matters.",
    "Okay, tempo shift. I see you.",
  ],
  Snarky: [
    "Ah yes, the ‘trust the vibes’ strategy.",
    "Cute. Let’s see where that goes.",
    "That square didn’t ask for this, but okay.",
    "A choice was made today.",
    "Bold… in an interesting way.",
  ],
  Encouraging: [
    "Nice! Keep that momentum going.",
    "Good idea—stay focused.",
    "Solid move. You’ve got this.",
    "Great effort—keep applying pressure.",
    "Love the confidence. Keep it up.",
  ],
};

const MOVE_FALLBACK_BY_TONE = {
  Playful: [
    "Alright, alright—making it interesting.",
    "A move with vibes. I’ll allow it.",
    "Calculated… or just lucky?",
    "You’re really committing to that idea, huh?",
  ],
  Competitive: [
    "Good. Now defend it.",
    "Strong tempo—don’t blink.",
    "Nice. But can you follow through?",
    "Okay—challenge accepted.",
  ],
  Snarky: [
    "Sure, why not. Let’s roll with that.",
    "That’s… certainly a move.",
    "Risky. I like watching chaos.",
    "You’re going for ‘surprise me,’ huh?",
  ],
  Encouraging: [
    "Nice move—keep building your plan.",
    "Good progress. Stay sharp.",
    "Great! One step at a time.",
    "You’re improving—keep it up.",
  ],
};

const WIN_FALLBACK_BY_TONE = {
  Playful: [
    "GG! That was smooth.",
    "Winner energy detected. Nicely done.",
    "You earned that one—respect.",
    "Okay, that was actually impressive.",
  ],
  Competitive: [
    "GG. You closed it out clean.",
    "That’s a win—well played.",
    "Clutch finish. Respect.",
    "You took the match. Nicely done.",
  ],
  Snarky: [
    "Well. That escalated quickly. GG.",
    "Okay, okay—you win this one.",
    "Fine. That was good. GG.",
    "You got it. I’ll pretend I’m not impressed.",
  ],
  Encouraging: [
    "Amazing win—great focus!",
    "You did it! Fantastic job.",
    "Well played—your strategy paid off.",
    "Huge win. Be proud of that one.",
  ],
};

const DRAW_FALLBACK_BY_TONE = {
  Playful: [
    "A draw. Perfectly balanced—like a boring masterpiece.",
    "Nobody wins. Everybody gets snacks.",
    "Draw game. The board remains unconquered.",
    "Stalemate! That was oddly poetic.",
  ],
  Competitive: [
    "Draw. Tough match—run it back.",
    "No winner today. Respect the defense.",
    "Stalemate. Rematch energy.",
    "Evenly matched. Next game decides it.",
  ],
  Snarky: [
    "A draw. Congrats to… the void.",
    "Nobody won. The board wins.",
    "Stalemate. The drama was real, though.",
    "A draw—like a cliffhanger nobody asked for.",
  ],
  Encouraging: [
    "Draw game—great resilience from both sides!",
    "Nice fight—call it even and go again.",
    "Good effort! That was a close one.",
    "Solid game. You held your ground.",
  ],
};

/**
 * In-memory cache for common situations during a session.
 * key: `${event}:${hash}`
 */
const cache = new Map();

function shouldWarnDev() {
  return process.env.REACT_APP_NODE_ENV !== "production";
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeTone(tone) {
  if (!tone || typeof tone !== "string") return "Playful";
  return TONES.includes(tone) ? tone : "Playful";
}

function normalizeFrequency(frequency) {
  if (!frequency || typeof frequency !== "string") return "Every move";
  return FREQUENCIES.includes(frequency) ? frequency : "Every move";
}

function getFallbackForEvent(event, tone) {
  const safeTone = normalizeTone(tone);

  if (event === "win") return pickRandom(WIN_FALLBACK_BY_TONE[safeTone]);
  if (event === "draw") return pickRandom(DRAW_FALLBACK_BY_TONE[safeTone]);
  if (event === "move") return pickRandom(MOVE_FALLBACK_BY_TONE[safeTone]);

  // Unknown event => generic
  return pickRandom(FALLBACK_QUIPS_BY_TONE[safeTone]);
}

/**
 * PUBLIC_INTERFACE
 * Create a stable hash for a 3x3 board plus small context.
 * @param {Array<"X"|"O"|null>} boardState
 * @param {string} currentPlayer
 * @param {number|null|undefined} lastMoveIndex
 * @param {"move"|"win"|"draw"} event
 * @param {"X"|"O"|undefined} winner
 * @param {string|undefined} tone
 * @param {string|undefined} frequency
 * @returns {string}
 */
export function hashTrashTalkContext(
  boardState,
  currentPlayer,
  lastMoveIndex,
  event,
  winner,
  tone,
  frequency
) {
  // Board string: X/O/-
  const b = (boardState || [])
    .map((v) => (v === "X" ? "X" : v === "O" ? "O" : "-"))
    .join("");

  const safeTone = normalizeTone(tone);
  const safeFreq = normalizeFrequency(frequency);

  return `${event}|t:${safeTone}|f:${safeFreq}|p:${currentPlayer || "-"}|m:${
    Number.isInteger(lastMoveIndex) ? lastMoveIndex : "-"
  }|w:${winner || "-"}|b:${b}`;
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
 *  winner?: "X"|"O",
 *  tone?: "Playful"|"Competitive"|"Snarky"|"Encouraging",
 *  frequency?: "Key events only (win/draw)"|"Every 2 moves"|"Every move"
 * }} context
 * @returns {Promise<string>}
 */
export async function generateTrashTalk(context) {
  const apiKey = getOpenAIApiKey();

  const tone = normalizeTone(context?.tone);
  const frequency = normalizeFrequency(context?.frequency);

  const hash = hashTrashTalkContext(
    context.boardState,
    context.currentPlayer,
    context.lastMoveIndex,
    context.event,
    context.winner,
    tone,
    frequency
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
    const q = getFallbackForEvent(context.event, tone);
    cache.set(cacheKey, q);
    return q;
  }

  // Minimal prompt with constraints + tone guidance.
  const boardPretty = (context.boardState || [])
    .map((v, i) => `${i}:${v || "-"}`)
    .join(" ");

  const system = [
    "You are a PG-rated commentator for a Tic Tac Toe game.",
    "Write 1–2 short sentences max; be concise and punchy.",
    TONE_GUIDELINES[tone] || TONE_GUIDELINES.Playful,
    "Safety constraints: no profanity; no slurs; no hate; no harassment; no insults about protected traits.",
    "Do not attack the player personally—react only to the move/game state.",
    "Avoid mentioning 'OpenAI' or model names.",
    "Do not use more than 180 characters.",
  ].join(" ");

  const user = [
    `Tone preset: ${tone}`,
    `Frequency setting: ${frequency}`,
    `Event: ${context.event}`,
    context.event === "win" ? `Winner: ${context.winner}` : "",
    `Current player (next to move): ${context.currentPlayer}`,
    `Last move index: ${context.lastMoveIndex}`,
    `Board: ${boardPretty}`,
    "Give a short quip reacting to this moment.",
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
    const finalText = cleaned || getFallbackForEvent(context.event, tone);

    cache.set(cacheKey, finalText);
    return finalText;
  } catch (err) {
    if (shouldWarnDev()) {
      // eslint-disable-next-line no-console
      console.warn("[trashTalk] OpenAI call failed; using fallback.", err);
    }
    const q = getFallbackForEvent(context.event, tone);
    cache.set(cacheKey, q);
    return q;
  }
}
