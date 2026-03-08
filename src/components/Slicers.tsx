import { useState, useMemo } from 'react'

interface SlicersProps {
  data: any[]
  onFilter: (filters: FilterConfig) => void
}

export interface FilterConfig {
  dropdowns: { [key: string]: string }
  multiSelect: { [key: string]: string[] }
  dateRange: { column: string; start: string; end: string } | null
}

interface ColumnInfo {
  name: string
  type: 'string' | 'number' | 'date'
  uniqueValues?: string[]
  minValue?: number
  maxValue?: number
}

export default function Slicers({ data, onFilter }: SlicersProps) {
  const [dropdownFilters, setDropdownFilters] = useState<{
    [key: string]: string
  }>({})
  const [multiSelectFilters, setMultiSelectFilters] = useState<{
    [key: string]: string[]
  }>({})
  const [dateRange, setDateRange] = useState<{
    column: string
    start: string
    end: string
  } | null>(null)

  const columnsInfo = useMemo(() => {
    if (!data || data.length === 0) return []

    const columns: ColumnInfo[] = []
    const firstRow = data[0]

    Object.keys(firstRow).forEach((colName) => {
      const values = data.map((row) => row[colName])
      const nonNullValues = values.filter((v) => v !== null && v !== undefined)

      let type: 'string' | 'number' | 'date' = 'string'
      let uniqueValues: string[] = []
      let minValue: number | undefined
      let maxValue: number | undefined

      if (nonNullValues.length > 0) {
        const firstVal = nonNullValues[0]

        if (typeof firstVal === 'number') {
          type = 'number'
          const nums = nonNullValues.filter((v) => typeof v === 'number') as number[]
          minValue = Math.min(...nums)
          maxValue = Math.max(...nums)
        } else if (
          typeof firstVal === 'string' &&
          /^\d{4}-\d{2}-\d{2}/.test(firstVal)
        ) {
          type = 'date'
        } else {
          type = 'string'
          uniqueValues = Array.from(new Set(nonNullValues.map((v) => String(v)))).sort()
        }
      }

      columns.push({
        name: colName,
        type,
        uniqueValues,
        minValue,
        maxValue,
      })
    })

    return columns
  }, [data])

  const handleDropdownChange = (column: string, value: string) => {
    const newFilters = { ...dropdownFilters }
    if (value === '') {
      delete newFilters[column]
    } else {
      newFilters[column] = value
    }
    setDropdownFilters(newFilters)
    applyFilters(newFilters, multiSelectFilters, dateRange)
  }

  const handleMultiSelectChange = (column: string, value: string) => {
    const newFilters = { ...multiSelectFilters }
    if (!newFilters[column]) {
      newFilters[column] = []
    }

    const idx = newFilters[column].indexOf(value)
    if (idx > -1) {
      newFilters[column].splice(idx, 1)
    } else {
      newFilters[column].push(value)
    }

    if (newFilters[column].length === 0) {
      delete newFilters[column]
    }

    setMultiSelectFilters(newFilters)
    applyFilters(dropdownFilters, newFilters, dateRange)
  }

  const handleDateRangeChange = (
    column: string,
    start: string,
    end: string
  ) => {
    const newDateRange = start && end ? { column, start, end } : null
    setDateRange(newDateRange)
    applyFilters(dropdownFilters, multiSelectFilters, newDateRange)
  }

  const applyFilters = (
    dropdowns: { [key: string]: string },
    multiSelect: { [key: string]: string[] },
    dateRangeVal: { column: string; start: string; end: string } | null
  ) => {
    onFilter({
      dropdowns,
      multiSelect,
      dateRange: dateRangeVal,
    })
  }

  const stringColumns = columnsInfo.filter(
    (c) => c.type === 'string' && c.name.toLowerCase() !== 'claim number'
  )
  const dateColumns = columnsInfo.filter((c) => c.type === 'date')

  return (
    <div className="slicers-container">
      <h2>🎚️ Slicers & Filters</h2>

      {stringColumns.length > 0 && (
        <div className="slicer-section">
          <h3>Category Filters</h3>
          <div className="slicer-grid">
            {stringColumns.map((col) => (
              <div key={col.name} className="slicer-item">
                <label>{col.name}</label>
                <select
                  value={dropdownFilters[col.name] || ''}
                  onChange={(e) =>
                    handleDropdownChange(col.name, e.target.value)
                  }
                  className="slicer-select"
                >
                  <option value="">All</option>
                  {col.uniqueValues?.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {stringColumns.length > 0 && (
        <div className="slicer-section">
          <h3>Multi-Select Filters</h3>
          <div className="multiselect-grid">
            {stringColumns.slice(0, 2).map((col) => (
              <div key={col.name} className="multiselect-item">
                <label>{col.name}</label>
                <div className="checkbox-list">
                  {col.uniqueValues?.slice(0, 5).map((val) => (
                    <label key={val} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={
                          multiSelectFilters[col.name]?.includes(val) || false
                        }
                        onChange={() =>
                          handleMultiSelectChange(col.name, val)
                        }
                      />
                      {val}
                    </label>
                  ))}
                  {(col.uniqueValues?.length || 0) > 5 && (
                    <p className="text-muted">
                      +{(col.uniqueValues?.length || 0) - 5} more
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dateColumns.length > 0 && (
        <div className="slicer-section">
          <h3>Date Range</h3>
          <div className="date-range-item">
            <label>{dateColumns[0].name}</label>
            <div className="date-inputs">
              <input
                type="date"
                value={dateRange?.start || ''}
                onChange={(e) =>
                  handleDateRangeChange(
                    dateColumns[0].name,
                    e.target.value,
                    dateRange?.end || ''
                  )
                }
                placeholder="From"
              />
              <span>to</span>
              <input
                type="date"
                value={dateRange?.end || ''}
                onChange={(e) =>
                  handleDateRangeChange(
                    dateColumns[0].name,
                    dateRange?.start || '',
                    e.target.value
                  )
                }
                placeholder="To"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
