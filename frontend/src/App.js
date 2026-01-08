import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import TrashTalkPanel from "./components/TrashTalkPanel";
import { generateTrashTalk } from "./services/trashTalkService";

/**
 * All winning line combinations (by index in a 0..8 3x3 board).
 */
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Compute winner and the winning line (if any).
 * @param {Array<"X"|"O"|null>} squares
 * @returns {{winner: ("X"|"O"|null), line: number[]|null}}
 */
function calculateWinner(squares) {
  for (const [a, b, c] of WIN_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: null };
}

/**
 * Create an empty board (9 nulls).
 * @returns {Array<null>}
 */
function emptyBoard() {
  return Array(9).fill(null);
}

/**
 * Square button for the board.
 * @param {{
 *  value: ("X"|"O"|null),
 *  onClick: () => void,
 *  isWinning: boolean,
 *  index: number,
 *  disabled: boolean
 * }} props
 */
function Square({ value, onClick, isWinning, index, disabled }) {
  const ariaLabel = value
    ? `Square ${index + 1}, ${value}`
    : `Square ${index + 1}, empty`;

  return (
    <button
      type="button"
      className={[
        "ttt-square",
        value ? "ttt-square--filled" : "",
        value === "X" ? "ttt-square--x" : "",
        value === "O" ? "ttt-square--o" : "",
        isWinning ? "ttt-square--win" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={Boolean(value)}
    >
      <span className="ttt-square__value" aria-hidden="true">
        {value}
      </span>
    </button>
  );
}

/**
 * Board UI for 3x3 squares.
 * @param {{
 *  squares: Array<"X"|"O"|null>,
 *  onPlayAt: (idx: number) => void,
 *  winningLine: number[] | null,
 *  disabled: boolean
 * }} props
 */
function Board({ squares, onPlayAt, winningLine, disabled }) {
  const winningSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);

  return (
    <div className="ttt-board" role="grid" aria-label="Tic Tac Toe board">
      {squares.map((value, idx) => (
        <div key={idx} role="row" className="ttt-board__cell">
          <Square
            value={value}
            index={idx}
            isWinning={winningSet.has(idx)}
            disabled={disabled || Boolean(value)}
            onClick={() => onPlayAt(idx)}
          />
        </div>
      ))}
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /**
   * History stores snapshots of the board across moves.
   * Each entry: { squares: Array<"X"|"O"|null>, lastMove: number|null }
   */
  const [history, setHistory] = useState([
    { squares: emptyBoard(), lastMove: null },
  ]);
  const [stepNumber, setStepNumber] = useState(0);
  const [xIsNext, setXIsNext] = useState(true);

  // Trash talk settings + UI state
  const [trashTalkEnabled, setTrashTalkEnabled] = useState(() => {
    try {
      const saved = window.localStorage.getItem("tt_trash_talk_enabled");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [trashTalkText, setTrashTalkText] = useState("");
  const [trashTalkLoading, setTrashTalkLoading] = useState(false);

  // Debounce + stale-response protection
  const debounceTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const current = history[stepNumber];
  const { winner, line: winningLine } = useMemo(
    () => calculateWinner(current.squares),
    [current.squares]
  );

  const isDraw = useMemo(() => {
    if (winner) return false;
    return current.squares.every((s) => s !== null);
  }, [current.squares, winner]);

  const currentPlayer = xIsNext ? "X" : "O";
  const gameOver = Boolean(winner) || isDraw;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "tt_trash_talk_enabled",
        String(trashTalkEnabled)
      );
    } catch {
      // ignore
    }
  }, [trashTalkEnabled]);

  function clearDebounce() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }

  // PUBLIC_INTERFACE
  function requestTrashTalk(context) {
    // No calls if disabled
    if (!trashTalkEnabled) return;

    // Debounce within 250ms
    clearDebounce();

    setTrashTalkLoading(true);
    const myRequestId = ++requestIdRef.current;

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const line = await generateTrashTalk(context);
        // Only apply if no newer request has been issued.
        if (requestIdRef.current === myRequestId) {
          setTrashTalkText(line);
        }
      } finally {
        if (requestIdRef.current === myRequestId) {
          setTrashTalkLoading(false);
        }
      }
    }, 250);
  }

  useEffect(() => {
    // Cleanup debounce on unmount
    return () => clearDebounce();
  }, []);

  // Scoreboard computed from the current end-state of the game.
  const score = useMemo(() => {
    if (winner === "X") return { x: 1, o: 0, d: 0 };
    if (winner === "O") return { x: 0, o: 1, d: 0 };
    if (isDraw) return { x: 0, o: 0, d: 1 };
    return { x: 0, o: 0, d: 0 };
  }, [winner, isDraw]);

  const statusText = useMemo(() => {
    if (winner) return `Winner: ${winner}`;
    if (isDraw) return "Draw game";
    return `Current player: ${currentPlayer}`;
  }, [winner, isDraw, currentPlayer]);

  // PUBLIC_INTERFACE
  function handlePlayAt(idx) {
    if (gameOver) return;
    if (current.squares[idx]) return; // invalid move => no API call

    // If user has time-traveled, discard future history
    const nextHistory = history.slice(0, stepNumber + 1);
    const nextSquares = current.squares.slice();
    nextSquares[idx] = currentPlayer;

    // Compute end-state based on the move we are about to commit.
    const nextResult = calculateWinner(nextSquares);
    const nextWinner = nextResult.winner;
    const nextIsDraw = !nextWinner && nextSquares.every((s) => s !== null);

    // Update state
    setHistory([
      ...nextHistory,
      {
        squares: nextSquares,
        lastMove: idx,
      },
    ]);
    setStepNumber(nextHistory.length);
    setXIsNext((prev) => !prev);

    // Request trash talk for the moment (move/win/draw).
    const event = nextWinner ? "win" : nextIsDraw ? "draw" : "move";
    requestTrashTalk({
      boardState: nextSquares,
      currentPlayer: nextWinner || nextIsDraw ? currentPlayer : xIsNext ? "O" : "X",
      lastMoveIndex: idx,
      event,
      winner: nextWinner || undefined,
    });
  }

  // PUBLIC_INTERFACE
  function handleJumpTo(moveIndex) {
    setStepNumber(moveIndex);
    setXIsNext(moveIndex % 2 === 0);
    // Clear pending talk and show something neutral.
    clearDebounce();
    setTrashTalkLoading(false);
    setTrashTalkText("");
  }

  // PUBLIC_INTERFACE
  function handleNewGame() {
    setHistory([{ squares: emptyBoard(), lastMove: null }]);
    setStepNumber(0);
    setXIsNext(true);
    clearDebounce();
    setTrashTalkLoading(false);
    setTrashTalkText("");
  }

  const moveButtons = useMemo(() => {
    return history.map((entry, moveIdx) => {
      const isCurrent = moveIdx === stepNumber;
      const desc =
        moveIdx === 0
          ? "Go to start"
          : `Go to move #${moveIdx} (square ${entry.lastMove + 1})`;

      return (
        <li key={moveIdx} className="ttt-moves__item">
          <button
            type="button"
            className={[
              "ttt-move",
              isCurrent ? "ttt-move--current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => handleJumpTo(moveIdx)}
            aria-current={isCurrent ? "step" : undefined}
          >
            {moveIdx === 0 ? "Start" : `Move #${moveIdx}`}
            {moveIdx !== 0 && (
              <span className="ttt-move__meta">
                {" "}
                (sq {entry.lastMove + 1})
              </span>
            )}
          </button>
        </li>
      );
    });
  }, [history, stepNumber]);

  return (
    <div className="app-root">
      <main className="ttt-shell">
        <header className="ttt-header">
          <div className="ttt-brand">
            <div className="ttt-badge" aria-hidden="true">
              TTT
            </div>
            <div>
              <h1 className="ttt-title">Tic Tac Toe</h1>
              <p className="ttt-subtitle">Two-player local game • Ocean Professional</p>
            </div>
          </div>

          <div className="ttt-scoreboard" aria-label="Scoreboard">
            <div className="ttt-score ttt-score--x">
              <div className="ttt-score__label">X</div>
              <div className="ttt-score__value">{score.x}</div>
            </div>
            <div className="ttt-score ttt-score--d">
              <div className="ttt-score__label">Draw</div>
              <div className="ttt-score__value">{score.d}</div>
            </div>
            <div className="ttt-score ttt-score--o">
              <div className="ttt-score__label">O</div>
              <div className="ttt-score__value">{score.o}</div>
            </div>
          </div>
        </header>

        <section className="ttt-card" aria-label="Game">
          <div className="ttt-status" aria-live="polite" role="status">
            <span className="ttt-status__pill">{statusText}</span>
            {winner && (
              <span className="ttt-status__note">
                Winning line highlighted on the board.
              </span>
            )}
          </div>

          <div className="ttt-content">
            <div className="ttt-boardWrap">
              <Board
                squares={current.squares}
                onPlayAt={handlePlayAt}
                winningLine={winningLine}
                disabled={gameOver}
              />

              <TrashTalkPanel
                enabled={trashTalkEnabled}
                onToggle={setTrashTalkEnabled}
                text={trashTalkText}
                loading={trashTalkLoading}
              />

              <div className="ttt-actions">
                <button
                  type="button"
                  className="ttt-btn ttt-btn--primary"
                  onClick={handleNewGame}
                >
                  New Game
                </button>
                <button
                  type="button"
                  className="ttt-btn"
                  onClick={() => handleJumpTo(0)}
                  disabled={stepNumber === 0}
                >
                  Reset to Start
                </button>
              </div>

              <p className="ttt-hint">
                Tip: Use <kbd>Tab</kbd> to focus squares and <kbd>Enter</kbd>/<kbd>Space</kbd> to place a mark.
              </p>
            </div>

            <aside className="ttt-history" aria-label="Move history">
              <h2 className="ttt-history__title">Move History</h2>
              <ol className="ttt-moves">{moveButtons}</ol>
            </aside>
          </div>
        </section>

        <footer className="ttt-footer">
          <span className="ttt-footer__muted">
            No backend required. Local two-player gameplay.
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
