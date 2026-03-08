import { useState, useMemo } from 'react'

interface PivotTableProps {
  data: any[]
  visibleColumns: string[]
}

export default function PivotTable({
  data,
  visibleColumns,
}: PivotTableProps) {
  const [groupByField, setGroupByField] = useState<string>('')
  const [aggregateField, setAggregateField] = useState<string>('')
  const [aggregationType, setAggregationType] = useState<'sum' | 'count' | 'avg'>(
    'sum'
  )

  const availableFields = useMemo(
    () => (data.length > 0 ? Object.keys(data[0]) : []),
    [data]
  )

  const numericFields = useMemo(
    () =>
      availableFields.filter((field) =>
        data.some((row) => typeof row[field] === 'number')
      ),
    [availableFields, data]
  )

  const pivotedData = useMemo(() => {
    if (!groupByField || !aggregateField) return []

    const grouped: { [key: string]: any[] } = {}

    // Group data
    data.forEach((row) => {
      const groupKey = String(row[groupByField])
      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(row)
    })

    // Aggregate
    return Object.entries(grouped).map(([groupKey, rows]) => {
      let aggregatedValue: number = 0

      if (aggregationType === 'sum') {
        aggregatedValue = rows.reduce(
          (sum, row) => sum + (Number(row[aggregateField]) || 0),
          0
        )
      } else if (aggregationType === 'count') {
        aggregatedValue = rows.length
      } else if (aggregationType === 'avg') {
        const total = rows.reduce(
          (sum, row) => sum + (Number(row[aggregateField]) || 0),
          0
        )
        aggregatedValue = rows.length > 0 ? total / rows.length : 0
      }

      return {
        [groupByField]: groupKey,
        [aggregateField]: aggregatedValue.toFixed(2),
        Count: rows.length,
      }
    })
  }, [data, groupByField, aggregateField, aggregationType])

  if (visibleColumns.length === 0) {
    return (
      <div className="pivot-container">
        <p className="no-columns-message">
          Please select at least one column to display
        </p>
      </div>
    )
  }

  return (
    <div className="pivot-container">
      <h2>Pivot Table</h2>

      <div className="pivot-controls">
        <div className="pivot-control-group">
          <label htmlFor="group-by">Group By</label>
          <select
            id="group-by"
            value={groupByField}
            onChange={(e) => setGroupByField(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a field...</option>
            {availableFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="aggregate-field">Aggregate Field</label>
          <select
            id="aggregate-field"
            value={aggregateField}
            onChange={(e) => setAggregateField(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a field...</option>
            {numericFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="agg-type">Aggregation</label>
          <select
            id="agg-type"
            value={aggregationType}
            onChange={(e) =>
              setAggregationType(e.target.value as 'sum' | 'count' | 'avg')
            }
            className="pivot-select"
          >
            <option value="sum">Sum</option>
            <option value="count">Count</option>
            <option value="avg">Average</option>
          </select>
        </div>
      </div>

      {groupByField && aggregateField ? (
        <div className="table-wrapper">
          <table className="pivot-table">
            <thead>
              <tr>
                <th>{groupByField}</th>
                <th>
                  {aggregationType.charAt(0).toUpperCase() +
                    aggregationType.slice(1)}{' '}
                  {aggregateField}
                </th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {pivotedData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row[groupByField]}</td>
                  <td className="number">{row[aggregateField]}</td>
                  <td className="number">{row.Count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-columns-message">
          Please select a field to group by and a field to aggregate
        </p>
      )}
    </div>
  )
}
