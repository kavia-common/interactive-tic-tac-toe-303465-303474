import React from "react";

/**
 * PUBLIC_INTERFACE
 * Toggle UI for enabling/disabling trash talk.
 * @param {{
 *   enabled: boolean,
 *   onChange: (enabled: boolean) => void,
 *   disabled?: boolean
 * }} props
 */
export default function TrashTalkToggle({ enabled, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={[
        "ttt-tt-toggle",
        enabled ? "ttt-tt-toggle--on" : "ttt-tt-toggle--off",
      ].join(" ")}
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      role="switch"
      aria-checked={enabled}
      aria-label="Enable trash talk"
      title="Enable trash talk"
    >
      <span className="ttt-tt-toggle__track" aria-hidden="true">
        <span className="ttt-tt-toggle__thumb" aria-hidden="true" />
      </span>
      <span className="ttt-tt-toggle__label">
        Trash talk{" "}
        <span className="ttt-tt-toggle__state">{enabled ? "On" : "Off"}</span>
      </span>
    </button>
  );
}
