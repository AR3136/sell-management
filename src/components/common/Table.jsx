import './Table.css';
import EmptyState from './EmptyState';

export default function Table({
  headers = [],
  data = [],
  renderRow,
  emptyMessage = 'No records found',
  className = '',
}) {
  if (data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className={`table-container ${className}`}>
      <table className="custom-table">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => renderRow(item, idx))}
        </tbody>
      </table>
    </div>
  );
}
