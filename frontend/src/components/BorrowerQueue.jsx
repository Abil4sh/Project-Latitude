export default function BorrowerQueue({ borrowers, selectedId, onSelect }) {
  return (
    <nav className="queue" aria-label="Borrower queue">
      <div className="queue-header">
        {borrowers.length} borrower{borrowers.length === 1 ? '' : 's'} on record
      </div>
      {borrowers.map((b) => (
        <button
          key={b.borrower_id}
          className={`queue-item${b.borrower_id === selectedId ? ' active' : ''}`}
          onClick={() => onSelect(b.borrower_id)}
        >
          <div>
            <div className="bid">{b.borrower_id}</div>
            <div className="meta">{b.months_on_record} months on record</div>
          </div>
          <div className="meta mono">DTI {(b.dti * 100).toFixed(0)}%</div>
        </button>
      ))}
    </nav>
  )
}
