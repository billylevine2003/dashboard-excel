interface DataTableProps {
  data: any[]
  visibleColumns: string[]
}

export default function DataTable({ data, visibleColumns }: DataTableProps) {
  if (!data || data.length === 0) {
    return <div className="table-container">No data to display</div>
  }

  if (visibleColumns.length === 0) {
    return (
      <div className="table-container">
        <h2>Data Table</h2>
        <p className="no-columns-message">
          Please select at least one column to display
        </p>
      </div>
    )
  }

  return (
    <div className="table-container">
      <h2>Data Table</h2>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((row, idx) => (
              <tr key={idx}>
                {visibleColumns.map((col) => (
                  <td key={col}>{String(row[col] ?? '-')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 50 && (
        <p className="table-note">Showing 50 of {data.length} rows</p>
      )}
    </div>
  )
}
