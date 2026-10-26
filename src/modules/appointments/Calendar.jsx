import { ymd } from '../../lib/utils.js';

// Date picker. Uses the browser's built-in calendar, so every date can be clicked.
// `days` limits how far ahead a date can be picked (the server only offers slots that far ahead).
export default function Calendar({ selected, onSelect, days }) {
  const today = ymd(new Date());
  let max;
  if (days) { const last = new Date(); last.setDate(last.getDate() + days - 1); max = ymd(last); }

  return (
    <input
      type="date"
      className="date-input"
      value={selected}
      min={today}
      max={max}
      onChange={(e) => onSelect(e.target.value)}
    />
  );
}
