import { useMemo, useState } from 'react'

interface LeftPanelProps {
  data: any[]
  filters: {
    selectedValues: { [key: string]: string[] }
    claimReportedDateRange: { start: string; end: string }
  }
  onFilterChange: (filters: {
    selectedValues: { [key: string]: string[] }
    claimReportedDateRange: { start: string; end: string }
  }) => void
}

const FILTER_FIELDS = [
  {
    name: 'Adjuster Code',
    sourceColumns: ['Claim Component Adjuster Code'],
  },
  { name: 'Peril Description', sourceColumns: ['Peril Description'] },
  { name: 'Loss Cause', sourceColumns: ['Cause of Loss'] },
  {
    name: 'Sub Loss Cause',
    sourceColumns: ['Cause of Loss Subcode', 'Cause of Loss Sub Code', 'Cause of Loss Sub Codes'],
  },
  {
    name: 'Claim Component Status Code',
    sourceColumns: ['Claim Component Status Code'],
  },
  { name: 'Age Category', sourceColumns: ['Claim Age Category'] },
  { name: 'Claim Reported Month-Year', sourceColumns: ['Claim Reported Month-Year'] },
]

export default function LeftPanel({
  data,
  filters,
  onFilterChange,
}: LeftPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({})

  const resolveColumnName = (candidateColumns: string[]): string => {
    const availableColumns = data.length > 0 ? Object.keys(data[0]) : []
    const normalizedMap = new Map<string, string>()

    availableColumns.forEach((column) => {
      normalizedMap.set(column.trim().toLowerCase(), column)
    })

    for (const candidate of candidateColumns) {
      const resolved = normalizedMap.get(candidate.trim().toLowerCase())
      if (resolved) {
        return resolved
      }
    }

    return candidateColumns[0]
  }

  const toggleSection = (fieldName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  const fieldValues = useMemo(() => {
    const values: { [key: string]: string[] } = {}

    FILTER_FIELDS.forEach(({ name, sourceColumns }) => {
      const sourceColumn = resolveColumnName(sourceColumns)
      const uniqueValues = Array.from(
        new Set(
          data
            .map((row) => row[sourceColumn])
            .filter((v) => v !== null && v !== undefined)
        )
      )
        .map((v) => String(v))
        .sort()

      values[name] = uniqueValues
    })

    return values
  }, [data])

  const handleToggle = (sourceColumn: string, value: string) => {
    const currentFilters = filters.selectedValues[sourceColumn] || []
    const newFilters = { ...filters.selectedValues }

    if (currentFilters.includes(value)) {
      newFilters[sourceColumn] = currentFilters.filter((v) => v !== value)
    } else {
      newFilters[sourceColumn] = [...currentFilters, value]
    }

    onFilterChange({
      ...filters,
      selectedValues: newFilters,
    })
  }

  const handleClearAll = (sourceColumn: string) => {
    const newFilters = { ...filters.selectedValues }
    newFilters[sourceColumn] = []
    onFilterChange({
      ...filters,
      selectedValues: newFilters,
    })
  }

  const handleDateRangeChange = (start: string, end: string) => {
    onFilterChange({
      ...filters,
      claimReportedDateRange: { start, end },
    })
  }

  return (
    <div className="left-panel">
      <div className="collapsible-section-header">
        <h2>Filters</h2>
        <button
          type="button"
          className="collapse-btn"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>

      {!isCollapsed && FILTER_FIELDS.map(({ name, sourceColumns }) => {
        const sourceColumn = resolveColumnName(sourceColumns)

        return (
        <div key={name} className="filter-group-panel">
          <div className="filter-group-header">
            <h3>{name}</h3>
            <div className="filter-header-buttons">
              <button
                onClick={() => toggleSection(name)}
                className="collapse-btn"
                title={collapsedSections[name] ? 'Expand' : 'Collapse'}
              >
                {collapsedSections[name] ? '▶' : '▼'}
              </button>
              {(filters.selectedValues[sourceColumn]?.length || 0) > 0 && (
                <button
                  onClick={() => handleClearAll(sourceColumn)}
                  className="clear-filter-btn"
                  title="Clear filters"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {!collapsedSections[name] && (
            <div className="filter-checkboxes">
              {fieldValues[name]?.length > 0 ? (
                fieldValues[name].map((value) => (
                  <label key={value} className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(filters.selectedValues[sourceColumn] || []).includes(value)}
                      onChange={() => handleToggle(sourceColumn, value)}
                    />
                    <span className="checkbox-text">{value}</span>
                  </label>
                ))
              ) : (
                <p className="no-values-text">No values available</p>
              )}
            </div>
          )}
        </div>
      )})}

      {!isCollapsed && <div className="filter-group-panel">
        <div className="filter-group-header">
          <h3>Claim Reported Date Range</h3>
          {(filters.claimReportedDateRange.start || filters.claimReportedDateRange.end) && (
            <button
              onClick={() => handleDateRangeChange('', '')}
              className="clear-filter-btn"
              title="Clear date range"
            >
              ✕
            </button>
          )}
        </div>

        <div className="date-inputs">
          <input
            type="date"
            value={filters.claimReportedDateRange.start}
            onChange={(e) =>
              handleDateRangeChange(e.target.value, filters.claimReportedDateRange.end)
            }
            placeholder="From"
          />
          <span>to</span>
          <input
            type="date"
            value={filters.claimReportedDateRange.end}
            onChange={(e) =>
              handleDateRangeChange(filters.claimReportedDateRange.start, e.target.value)
            }
            placeholder="To"
          />
        </div>
      </div>}
    </div>
  )
}
