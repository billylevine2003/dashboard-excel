import { useState } from 'react'
import * as XLSX from 'xlsx'
import DataTable from './components/DataTable'
import PivotTable from './components/PivotTable'
import Charts from './components/Charts'
import FileUpload from './components/FileUpload'
import FilterSearch from './components/FilterSearch'
import Slicers from './components/Slicers'
import LeftPanel from './components/LeftPanel'
import KeyMetrics from './components/KeyMetrics'
import './App.css'

interface ExcelData {
  [key: string]: any[]
}

const isDateLikeField = (fieldName: string): boolean =>
  fieldName.trim().toLowerCase().includes('date')

const formatExcelDateValue = (value: unknown): unknown => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value
  }

  const parsed = XLSX.SSF.parse_date_code(value)
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
    return value
  }

  const year = String(parsed.y).padStart(4, '0')
  const month = String(parsed.m).padStart(2, '0')
  const day = String(parsed.d).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractMonthYear = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/)
    if (match) {
      return `${match[1]}-${match[2]}`
    }
  }

  if (value instanceof Date) {
    const year = String(value.getFullYear())
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  return null
}

const normalizeDateFieldsInRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...row }

  Object.keys(normalized).forEach((key) => {
    if (isDateLikeField(key)) {
      normalized[key] = formatExcelDateValue(normalized[key])
    }
  })

  const claimReportedDateKey = Object.keys(normalized).find(
    (key) => key.trim().toLowerCase() === 'claim reported date'
  )

  if (claimReportedDateKey) {
    const monthYear = extractMonthYear(normalized[claimReportedDateKey])
    if (monthYear) {
      normalized['Claim Reported Month-Year'] = monthYear
    }
  }

  return normalized
}

function App() {
  const [data, setData] = useState<ExcelData | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [filteredData, setFilteredData] = useState<any[] | null>(null)
  const [viewMode, setViewMode] = useState<'charts' | 'table' | 'pivot'>('charts')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchColumn, setSearchColumn] = useState<string>('')
  const [slicerConfig, setSlicerConfig] = useState<any>(null)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [panelFilters, setPanelFilters] = useState<{ [key: string]: string[] }>({})
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false)

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        const sheets: ExcelData = {}
        
        workbook.SheetNames.forEach((name) => {
          const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[name]) as Record<string, unknown>[]
          sheets[name] = rawRows.map((row) => normalizeDateFieldsInRow(row))
        })
        
        setData(sheets)
        setSheetNames(workbook.SheetNames)
        setActiveSheet(workbook.SheetNames[0])
        setFilteredData(sheets[workbook.SheetNames[0]])
        setVisibleColumns(Object.keys(sheets[workbook.SheetNames[0]][0]))
      } catch (error) {
        alert('Error reading file: ' + (error as Error).message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFilter = (term: string, column?: string) => {
    if (!data || !activeSheet) return
    setSearchTerm(term)
    setSearchColumn(column || '')
    applyAllFilters(data[activeSheet], term, column, slicerConfig, panelFilters)
  }

  const handleSlicerFilter = (config: any) => {
    setSlicerConfig(config)
    if (!data || !activeSheet) return
    applyAllFilters(data[activeSheet], searchTerm, searchColumn || undefined, config, panelFilters)
  }

  const handlePanelFilterChange = (filters: { [key: string]: string[] }) => {
    setPanelFilters(filters)
    if (!data || !activeSheet) return
    applyAllFilters(data[activeSheet], searchTerm, searchColumn || undefined, slicerConfig, filters)
  }

  const applyAllFilters = (
    sheetData: any[],
    searchTerm: string,
    searchColumn?: string,
    config?: any,
    panelFilters?: { [key: string]: string[] }
  ) => {
    let filtered = [...sheetData]

    // Apply left panel filters
    if (panelFilters && Object.keys(panelFilters).length > 0) {
      Object.entries(panelFilters).forEach(([fieldName, selectedValues]: any) => {
        if (selectedValues.length > 0) {
          filtered = filtered.filter((row) =>
            selectedValues.includes(String(row[fieldName]))
          )
        }
      })
    }

    // Apply slicer filters
    if (config) {
      // Dropdown filters
      Object.entries(config.dropdowns).forEach(([colName, value]: any) => {
        if (value) {
          filtered = filtered.filter((row) => String(row[colName]) === value)
        }
      })

      // Date range filter
      if (config.dateRange) {
        const { column, start, end } = config.dateRange
        filtered = filtered.filter((row) => {
          const rowDate = String(row[column])
          return rowDate >= start && rowDate <= end
        })
      }
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((row) => {
        if (searchColumn) {
          return String(row[searchColumn])
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        }
        return Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    setFilteredData(filtered)
  }

  const handleExport = () => {
    if (!filteredData) return

    const worksheet = XLSX.utils.json_to_sheet(filteredData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export')
    XLSX.writeFile(workbook, 'dashboard-export.xlsx')
  }

  const currentData = activeSheet && data ? data[activeSheet] : null

  return (
    <div className="app">
      <header className="header">
        <h1>📊 Excel Dashboard</h1>
        <p>Upload, analyze, and visualize your Excel data</p>
      </header>

      <main className="container">
        <FileUpload onFileUpload={handleFileUpload} />

        {data && (
          <div className="main-content">
            <div className="left-sidebar">
              <div className="left-sidebar-header">
                <h2>Filters</h2>
                <button
                  type="button"
                  className="left-sidebar-toggle"
                  onClick={() => setIsLeftSidebarCollapsed((prev) => !prev)}
                >
                  {isLeftSidebarCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>

              {!isLeftSidebarCollapsed && (
                <>
                  {currentData && (
                    <>
                      <FilterSearch
                        data={currentData}
                        onFilter={handleFilter}
                        onExport={handleExport}
                        visibleColumns={visibleColumns}
                        onColumnsChange={setVisibleColumns}
                      />

                      <Slicers data={currentData} onFilter={handleSlicerFilter} />
                    </>
                  )}

                  <LeftPanel
                    data={data[activeSheet] || []}
                    filters={panelFilters}
                    onFilterChange={handlePanelFilterChange}
                  />
                </>
              )}
            </div>

            <div className="right-content">
              <div className="tabs">
                {sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    className={`tab ${activeSheet === sheet ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSheet(sheet)
                      setFilteredData(data[sheet])
                      setSearchTerm('')
                      setSearchColumn('')
                      setSlicerConfig(null)
                      setPanelFilters({})
                    }}
                  >
                    {sheet}
                  </button>
                ))}
              </div>

              {currentData && (
                <>
                  <KeyMetrics data={filteredData || currentData} />

                  <div className="view-toggle">
                    <button
                      className={`toggle-btn ${viewMode === 'charts' ? 'active' : ''}`}
                      onClick={() => setViewMode('charts')}
                    >
                      📊 Charts
                    </button>
                    <button
                      className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                      onClick={() => setViewMode('table')}
                    >
                      📋 Data Table
                    </button>
                    <button
                      className={`toggle-btn ${viewMode === 'pivot' ? 'active' : ''}`}
                      onClick={() => setViewMode('pivot')}
                    >
                      🔀 Pivot Table
                    </button>
                  </div>

                  {viewMode === 'charts' && (
                    <div className="chart-section">
                      <Charts
                        data={filteredData || currentData}
                        numericKeys={['Direct Loss Paid ITD', 'Direct Loss Reserve Outstanding']}
                      />
                    </div>
                  )}

                  {viewMode === 'table' && (
                    <div className="table-section">
                      <DataTable
                        data={filteredData || currentData}
                        visibleColumns={visibleColumns}
                      />
                    </div>
                  )}

                  {viewMode === 'pivot' && (
                    <div className="table-section">
                      <PivotTable
                        data={filteredData || currentData}
                        visibleColumns={visibleColumns}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
