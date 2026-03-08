import { useState } from 'react'
import * as XLSX from 'xlsx'
import DataTable from './components/DataTable'
import PivotTable from './components/PivotTable'
import Charts from './components/Charts'
import FileUpload from './components/FileUpload'
import FilterSearch from './components/FilterSearch'
import Slicers from './components/Slicers'
import LeftPanel from './components/LeftPanel'
import './App.css'

interface ExcelData {
  [key: string]: any[]
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

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' })
        const sheets: ExcelData = {}
        
        workbook.SheetNames.forEach((name) => {
          sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name])
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

      // Multi-select filters
      Object.entries(config.multiSelect).forEach(([colName, selectedValues]: any) => {
        if (selectedValues.length > 0) {
          filtered = filtered.filter((row) =>
            selectedValues.includes(String(row[colName]))
          )
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
            <LeftPanel
              data={data[activeSheet] || []}
              filters={panelFilters}
              onFilterChange={handlePanelFilterChange}
            />

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
                  <FilterSearch
                    data={currentData}
                    onFilter={handleFilter}
                    onExport={handleExport}
                    visibleColumns={visibleColumns}
                    onColumnsChange={setVisibleColumns}
                  />

                  <Slicers data={currentData} onFilter={handleSlicerFilter} />

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
