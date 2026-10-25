const TONES = ['blue', 'teal', 'purple', 'amber', 'rose', 'green'];

// "Dr. Maria Reyes" -> "MR"
export const initials = (name) =>
  name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function Avatar({ name, small }) {
  const tone = TONES[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TONES.length];
  return <span className={'person-avatar tone-' + tone + (small ? ' small' : '')}>{initials(name)}</span>;
}
