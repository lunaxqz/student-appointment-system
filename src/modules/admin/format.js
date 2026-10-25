// The API sends appointment times as ISO timestamps (PostgreSQL TIMESTAMPTZ); show them in the viewer's locale.
export const dateText = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const timeText = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
