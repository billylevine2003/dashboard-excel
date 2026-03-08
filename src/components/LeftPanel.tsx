import { useMemo, useState } from 'react'

interface LeftPanelProps {
  data: any[]
  filters: { [key: string]: string[] }
  onFilterChange: (filters: { [key: string]: string[] }) => void
}

const FILTER_FIELDS = [
  { name: 'Adjuster Code', sourceColumn: 'Claim Component Adjuster Code' },
  { name: 'Peril Description', sourceColumn: 'Peril Description' },
]

export default function LeftPanel({
  data,
  filters,
  onFilterChange,
}: LeftPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({})

  const toggleSection = (fieldName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }))
  }

  const fieldValues = useMemo(() => {
    const values: { [key: string]: string[] } = {}

    FILTER_FIELDS.forEach(({ name, sourceColumn }) => {
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

  const handleToggle = (fieldName: string, value: string) => {
    const currentFilters = filters[fieldName] || []
    const newFilters = { ...filters }

    if (currentFilters.includes(value)) {
      newFilters[fieldName] = currentFilters.filter((v) => v !== value)
    } else {
      newFilters[fieldName] = [...currentFilters, value]
    }

    onFilterChange(newFilters)
  }

  const handleClearAll = (fieldName: string) => {
    const newFilters = { ...filters }
    newFilters[fieldName] = []
    onFilterChange(newFilters)
  }

  return (
    <div className="left-panel">
      <h2>Filters</h2>

      {FILTER_FIELDS.map(({ name }) => (
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
              {(filters[name]?.length || 0) > 0 && (
                <button
                  onClick={() => handleClearAll(name)}
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
                      checked={(filters[name] || []).includes(value)}
                      onChange={() => handleToggle(name, value)}
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
      ))}
    </div>
  )
}
