import { useState, useMemo } from 'react'

interface PivotTableProps {
  data: any[]
  visibleColumns: string[]
}

interface GroupedPivotRow {
  key: string
  label: string
  values: { [key: string]: string }
  children: GroupedPivotRow[]
}

const isDateLikeField = (fieldName: string): boolean =>
  fieldName.trim().toLowerCase().includes('date')

const formatAggregateValue = (value: number, aggregationType: 'sum' | 'count' | 'avg'): string => {
  if (aggregationType === 'count') {
    return String(Math.round(value))
  }
  return value.toFixed(2)
}

export default function PivotTable({
  data,
  visibleColumns,
}: PivotTableProps) {
  const [parentGroupByField, setParentGroupByField] = useState<string>('')
  const [childGroupByField, setChildGroupByField] = useState<string>('')
  const [aggregateField1, setAggregateField1] = useState<string>('')
  const [aggregateField2, setAggregateField2] = useState<string>('')
  const [collapsedParents, setCollapsedParents] = useState<{ [key: string]: boolean }>({})
  const [aggregationType1, setAggregationType1] = useState<'sum' | 'count' | 'avg'>(
    'sum'
  )
  const [aggregationType2, setAggregationType2] = useState<'sum' | 'count' | 'avg'>(
    'sum'
  )

  const availableFields = useMemo(
    () => (data.length > 0 ? Object.keys(data[0]) : []),
    [data]
  )

  const numericFields = useMemo(
    () => {
      const fields = availableFields.filter((field) =>
        !isDateLikeField(field) && data.some((row) => typeof row[field] === 'number')
      )
      // Add Count as a virtual field
      fields.push('Count')
      return fields
    },
    [availableFields, data]
  )

  const getAggregateValue = (
    rows: any[],
    aggregateField: string,
    aggregationType: 'sum' | 'count' | 'avg'
  ): number => {
    if (!aggregateField) return 0
    if (aggregateField === 'Count' || aggregationType === 'count') {
      return rows.length
    }

    const total = rows.reduce(
      (sum, row) => sum + (Number(row[aggregateField]) || 0),
      0
    )

    if (aggregationType === 'avg') {
      return rows.length > 0 ? total / rows.length : 0
    }

    return total
  }

  const pivotedData = useMemo<GroupedPivotRow[]>(() => {
    if (!parentGroupByField) return []

    const groupedParents: { [key: string]: any[] } = {}

    // Group data by parent field
    data.forEach((row) => {
      const parentKey = String(row[parentGroupByField] ?? '-')
      if (!groupedParents[parentKey]) {
        groupedParents[parentKey] = []
      }
      groupedParents[parentKey].push(row)
    })

    const buildAggregates = (rows: any[]) => {
      const values: { [key: string]: string } = {}
      if (aggregateField1) {
        const value1 = getAggregateValue(rows, aggregateField1, aggregationType1)
        values[`${aggregateField1} (${aggregationType1})`] = formatAggregateValue(value1, aggregationType1)
      }
      if (aggregateField2) {
        const value2 = getAggregateValue(rows, aggregateField2, aggregationType2)
        values[`${aggregateField2} (${aggregationType2})`] = formatAggregateValue(value2, aggregationType2)
      }
      return values
    }

    return Object.entries(groupedParents).map(([parentKey, parentRows]) => {
      const parentRow: GroupedPivotRow = {
        key: parentKey,
        label: parentKey,
        values: buildAggregates(parentRows),
        children: [],
      }

      if (childGroupByField) {
        const groupedChildren: { [key: string]: any[] } = {}

        parentRows.forEach((row) => {
          const childKey = String(row[childGroupByField] ?? '-')
          if (!groupedChildren[childKey]) {
            groupedChildren[childKey] = []
          }
          groupedChildren[childKey].push(row)
        })

        parentRow.children = Object.entries(groupedChildren).map(([childKey, childRows]) => ({
          key: `${parentKey}__${childKey}`,
          label: childKey,
          values: buildAggregates(childRows),
          children: [],
        }))
      }

      return parentRow
    })
  }, [
    data,
    parentGroupByField,
    childGroupByField,
    aggregateField1,
    aggregateField2,
    aggregationType1,
    aggregationType2,
  ])

  const handleParentGroupChange = (field: string) => {
    setParentGroupByField(field)
    if (field && field === childGroupByField) {
      setChildGroupByField('')
    }
    setCollapsedParents({})
  }

  const handleChildGroupChange = (field: string) => {
    setChildGroupByField(field)
    setCollapsedParents({})
  }

  const toggleParentRow = (parentKey: string) => {
    setCollapsedParents((prev) => ({
      ...prev,
      [parentKey]: !prev[parentKey],
    }))
  }

  const groupableFields = useMemo(
    () => availableFields,
    [availableFields]
  )

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
          <label htmlFor="parent-group-by">Parent Group By</label>
          <select
            id="parent-group-by"
            value={parentGroupByField}
            onChange={(e) => handleParentGroupChange(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a field...</option>
            {groupableFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="child-group-by">Child Group By (Optional)</label>
          <select
            id="child-group-by"
            value={childGroupByField}
            onChange={(e) => handleChildGroupChange(e.target.value)}
            className="pivot-select"
            disabled={!parentGroupByField}
          >
            <option value="">None</option>
            {groupableFields
              .filter((field) => field !== parentGroupByField)
              .map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
          </select>
        </div>

        <div className="pivot-control-row">
          <div className="pivot-control-group">
            <label htmlFor="aggregate-field-1">Aggregate Field 1</label>
            <select
              id="aggregate-field-1"
              value={aggregateField1}
              onChange={(e) => setAggregateField1(e.target.value)}
              className="pivot-select"
            >
              <option value="">Select a field...</option>
              {numericFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <select
              value={aggregationType1}
              onChange={(e) =>
                setAggregationType1(e.target.value as 'sum' | 'count' | 'avg')
              }
              className="pivot-select"
            >
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="avg">Average</option>
            </select>
          </div>

          <div className="pivot-control-group">
            <label htmlFor="aggregate-field-2">Aggregate Field 2</label>
            <select
              id="aggregate-field-2"
              value={aggregateField2}
              onChange={(e) => setAggregateField2(e.target.value)}
              className="pivot-select"
            >
              <option value="">Select a field...</option>
              {numericFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <select
              value={aggregationType2}
              onChange={(e) =>
                setAggregationType2(e.target.value as 'sum' | 'count' | 'avg')
              }
              className="pivot-select"
            >
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="avg">Average</option>
            </select>
          </div>
        </div>
      </div>

      {parentGroupByField && (aggregateField1 || aggregateField2) ? (
        <div className="table-wrapper">
          <table className="pivot-table">
            <thead>
              <tr>
                <th>{parentGroupByField}</th>
                {childGroupByField && <th>{childGroupByField}</th>}
                {aggregateField1 && <th>{aggregateField1} ({aggregationType1})</th>}
                {aggregateField2 && <th>{aggregateField2} ({aggregationType2})</th>}
              </tr>
            </thead>
            <tbody>
              {pivotedData.map((parentRow) => {
                const parentIsCollapsed = !!collapsedParents[parentRow.key]
                return (
                  <>
                    <tr key={parentRow.key} className="pivot-parent-row">
                      <td>
                        {childGroupByField && parentRow.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleParentRow(parentRow.key)}
                            className="pivot-collapse-btn"
                            aria-label={parentIsCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            {parentIsCollapsed ? '▶' : '▼'}
                          </button>
                        )}
                        <span>{parentRow.label}</span>
                      </td>
                      {childGroupByField && <td className="pivot-empty-cell">-</td>}
                      {aggregateField1 && (
                        <td className="number">{parentRow.values[`${aggregateField1} (${aggregationType1})`]}</td>
                      )}
                      {aggregateField2 && (
                        <td className="number">{parentRow.values[`${aggregateField2} (${aggregationType2})`]}</td>
                      )}
                    </tr>

                    {childGroupByField &&
                      !parentIsCollapsed &&
                      parentRow.children.map((childRow) => (
                        <tr key={childRow.key} className="pivot-child-row">
                          <td className="pivot-empty-cell">-</td>
                          <td className="pivot-child-cell">{childRow.label}</td>
                          {aggregateField1 && (
                            <td className="number">{childRow.values[`${aggregateField1} (${aggregationType1})`]}</td>
                          )}
                          {aggregateField2 && (
                            <td className="number">{childRow.values[`${aggregateField2} (${aggregationType2})`]}</td>
                          )}
                        </tr>
                      ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-columns-message">
          Please select a parent group field and at least one field to aggregate
        </p>
      )}
    </div>
  )
}
