// "Showing 1–5 of 12 users" plus Previous / page numbers / Next.
export default function Pager({ page, totalItems, pageSize, onPage, noun }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(page, totalPages);
  const first = totalItems ? (current - 1) * pageSize + 1 : 0;
  const last = Math.min(current * pageSize, totalItems);

  return (
    <div className="table-footer">
      <span className="text-muted text-small">Showing {first}–{last} of {totalItems} {noun}</span>
      <div className="pager">
        <button className="page-button" disabled={current === 1} onClick={() => onPage(current - 1)}>Previous</button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button key={i} className={'page-button' + (current === i + 1 ? ' active' : '')} onClick={() => onPage(i + 1)}>{i + 1}</button>
        ))}
        <button className="page-button" disabled={current === totalPages} onClick={() => onPage(current + 1)}>Next</button>
      </div>
    </div>
  );
}
