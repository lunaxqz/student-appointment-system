// Shared loading / error panel for screens that fetch from the API.
// Uses the existing .empty-state, .error-text and .button styles.
export default function LoadState({ loading, error, onRetry, loadingText = 'Loading…' }) {
  if (loading) return <p className="text-muted empty-state" role="status">{loadingText}</p>;
  if (!error) return null;
  return (
    <div className="empty-state" role="alert">
      <div className="error-text">{error}</div>
      {onRetry && <button className="button" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}
