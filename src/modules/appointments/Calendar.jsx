import { ymd } from '../../lib/utils.js';

// Date picker. Uses the browser's built-in calendar, so every date can be clicked.
export default function Calendar({ selected, onSelect }) {
  const today = ymd(new Date());

  return (
    <input
      type="date"
      className="date-input"
      value={selected}
      min={today}
      onChange={(e) => onSelect(e.target.value)}
    />
  );
}
