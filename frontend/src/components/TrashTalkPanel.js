import React, { useEffect, useMemo, useState } from "react";
import TrashTalkToggle from "./TrashTalkToggle";

const TONE_OPTIONS = [
  { value: "Playful", label: "Playful" },
  { value: "Competitive", label: "Competitive" },
  { value: "Snarky", label: "Snarky" },
  { value: "Encouraging", label: "Encouraging" },
];

const FREQ_OPTIONS = [
  { value: "Key events only (win/draw)", label: "Key events only" },
  { value: "Every 2 moves", label: "Every 2 moves" },
  { value: "Every move", label: "Every move" },
];

/**
 * PUBLIC_INTERFACE
 * Animated panel that displays the latest trash talk line + compact settings.
 * @param {{
 *  enabled: boolean,
 *  onToggle: (enabled: boolean) => void,
 *  text: string,
 *  loading: boolean,
 *  tone: string,
 *  onToneChange: (tone: string) => void,
 *  frequency: string,
 *  onFrequencyChange: (freq: string) => void
 * }} props
 */
export default function TrashTalkPanel({
  enabled,
  onToggle,
  text,
  loading,
  tone,
  onToneChange,
  frequency,
  onFrequencyChange,
}) {
  const [animateKey, setAnimateKey] = useState(0);

  useEffect(() => {
    // Trigger slide/fade animation whenever text changes or loading finishes.
    setAnimateKey((k) => k + 1);
  }, [text, loading]);

  const display = useMemo(() => {
    if (loading) return "Thinking of something clever…";
    if (!enabled) return "Trash talk is off. (Quiet confidence mode.)";
    return text || "Make a move and I’ll have something to say.";
  }, [enabled, loading, text]);

  const note = useMemo(() => {
    const toneLabel =
      TONE_OPTIONS.find((o) => o.value === tone)?.label || "Playful";
    const freqLabel =
      FREQ_OPTIONS.find((o) => o.value === frequency)?.label || "Every move";

    if (!enabled) return "Enable it for cheeky commentary after moves, wins, and draws.";
    return `PG-rated, friendly. Tone: ${toneLabel}. Frequency: ${freqLabel}.`;
  }, [enabled, tone, frequency]);

  return (
    <section className="ttt-tt-panel" aria-label="Trash talk">
      <div className="ttt-tt-panel__header">
        <div className="ttt-tt-panel__titleRow">
          <span className="ttt-tt-panel__avatar" aria-hidden="true">
            {/* Simple inline “bot” icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 3h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 3v3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <rect
                x="5"
                y="7"
                width="14"
                height="12"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 12h.01M15 12h.01"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M9 16c1 .8 2 .8 3 .8s2 0 3-.8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <h3 className="ttt-tt-panel__title">Trash Talk</h3>
          <span className="ttt-tt-panel__accent" aria-hidden="true" />
        </div>

        <div className="ttt-tt-panel__controls" aria-label="Trash talk settings">
          <label className="ttt-tt-select" aria-label="Trash talk tone">
            <span className="ttt-tt-select__label">Tone</span>
            <select
              className="ttt-tt-select__control"
              value={tone}
              onChange={(e) => onToneChange(e.target.value)}
              disabled={!enabled}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ttt-tt-select" aria-label="Trash talk frequency">
            <span className="ttt-tt-select__label">Freq</span>
            <select
              className="ttt-tt-select__control"
              value={frequency}
              onChange={(e) => onFrequencyChange(e.target.value)}
              disabled={!enabled}
            >
              {FREQ_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <TrashTalkToggle enabled={enabled} onChange={onToggle} />
        </div>
      </div>

      <div
        key={animateKey}
        className={[
          "ttt-tt-panel__body",
          enabled ? "" : "ttt-tt-panel__body--muted",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="ttt-tt-panel__bubble">
          {loading ? (
            <div className="ttt-tt-shimmer" aria-hidden="true">
              <div className="ttt-tt-shimmer__bar ttt-tt-shimmer__bar--1" />
              <div className="ttt-tt-shimmer__bar ttt-tt-shimmer__bar--2" />
            </div>
          ) : (
            <p className="ttt-tt-panel__text">{display}</p>
          )}
        </div>
        <p className="ttt-tt-panel__note">{note}</p>
      </div>
    </section>
  );
}
