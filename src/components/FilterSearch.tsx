import { useState } from 'react'

interface FilterSearchProps {
  data: any[]
  onFilter: (searchTerm: string, columnName?: string) => void
  onExport: () => void
  visibleColumns: string[]
  onColumnsChange: (columns: string[]) => void
}

export default function FilterSearch({
  data,
  onFilter,
  onExport,
  visibleColumns,
  onColumnsChange,
}: FilterSearchProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [columnDisplayDropdownOpen, setColumnDisplayDropdownOpen] = useState(false)

  const columns = data.length > 0 ? Object.keys(data[0]) : []

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    onFilter(value, selectedColumns.length > 0 ? selectedColumns[0] : undefined)
  }

  const handleColumnToggleInFilter = (col: string) => {
    const newSelected = selectedColumns.includes(col)
      ? selectedColumns.filter((c) => c !== col)
      : [...selectedColumns, col]
    setSelectedColumns(newSelected)
    onFilter(searchTerm, newSelected.length > 0 ? newSelected[0] : undefined)
  }

  const handleClear = () => {
    setSearchTerm('')
    setSelectedColumns([])
    setDropdownOpen(false)
    onFilter('')
  }

  const handleColumnToggle = (col: string) => {
    onColumnsChange(
      visibleColumns.includes(col)
        ? visibleColumns.filter((c) => c !== col)
        : [...visibleColumns, col]
    )
  }

  return (
    <div className="filter-section">
      <div className="collapsible-section-header">
        <h2>🔎 Filter & Search</h2>
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

      {!isCollapsed && (
        <>
          <div className="filter-controls">
            <div className="search-group">
              <label htmlFor="search-input">🔍 Search</label>
              <input
                id="search-input"
                type="text"
                placeholder="Enter search term..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-group">
              <label>🔍 Search Columns</label>
              <div className="dropdown-container">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="dropdown-toggle"
                >
                  {selectedColumns.length > 0
                    ? `${selectedColumns.length} column(s) selected`
                    : 'Select columns...'}
                  <span className="dropdown-arrow">▼</span>
                </button>
                {dropdownOpen && (
                  <div className="dropdown-menu">
                    {columns.map((col) => (
                      <label key={col} className="dropdown-option">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col)}
                          onChange={() => handleColumnToggleInFilter(col)}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleClear} className="btn btn-secondary">
              Clear
            </button>

            <button onClick={onExport} className="btn btn-primary">
              📥 Export
            </button>
          </div>

          <div className="column-selector-section">
            <label>📊 Columns to Display</label>
            <div className="dropdown-container">
              <button
                onClick={() => setColumnDisplayDropdownOpen(!columnDisplayDropdownOpen)}
                className="dropdown-toggle"
              >
                {visibleColumns.length > 0
                  ? `${visibleColumns.length} column(s) selected`
                  : 'Select columns...'}
                <span className="dropdown-arrow">▼</span>
              </button>
              {columnDisplayDropdownOpen && (
                <div className="dropdown-menu">
                  {columns.map((col) => (
                    <label key={col} className="dropdown-option">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col)}
                        onChange={() => handleColumnToggle(col)}
                      />
                      {col}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
