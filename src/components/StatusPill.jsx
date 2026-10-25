export default function StatusPill({ status }) {
  return <span className={'status-pill status-' + status}>{status[0].toUpperCase() + status.slice(1)}</span>;
}
