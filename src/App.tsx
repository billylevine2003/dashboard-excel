import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import DataTable from './components/DataTable'
import PivotTable from './components/PivotTable'
import MatrixReport from './components/MatrixReport'
import Charts from './components/Charts'
import FileUpload from './components/FileUpload'
import FilterSearch from './components/FilterSearch'
import LeftPanel from './components/LeftPanel'
import KeyMetrics from './components/KeyMetrics'
import AdjusterSummary from './components/AdjusterSummary'
import LiabilityStandalonePanel from './components/LiabilityStandalonePanel'
import './App.css'

interface ExcelData {
  [key: string]: any[]
}

interface PanelFiltersState {
  selectedValues: { [key: string]: string[] }
  claimReportedDateRange: { start: string; end: string }
}

type MatrixDrilldownTarget =
  | 'open-claims'
  | 'open-without-pay'
  | 'closed-without-pay'
  | 'without-pay-all'
  | 'open-with-pay-paid'
  | 'open-with-pay-reserve'

const isDateLikeField = (fieldName: string): boolean =>
  fieldName.trim().toLowerCase().includes('date')

const normalizeFieldName = (fieldName: string): string => fieldName.trim().toLowerCase()

const isAdjusterFieldName = (fieldName: string): boolean => {
  const normalized = normalizeFieldName(fieldName)
  return (
    normalized === 'adjuster' ||
    normalized.includes('adjuster') ||
    normalized.includes('examiner')
  )
}

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

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const year = Number(isoMatch[1])
      const month = Number(isoMatch[2]) - 1
      const day = Number(isoMatch[3])
      return new Date(year, month, day)
    }

    const parsedTime = Date.parse(trimmed)
    if (!Number.isNaN(parsedTime)) {
      return new Date(parsedTime)
    }
  }

  return null
}

const getClaimAgeDays = (reportedDateValue: unknown): number | null => {
  const reportedDate = parseDateValue(reportedDateValue)
  if (!reportedDate) {
    return null
  }

  const today = new Date()
  const reportedUtc = Date.UTC(
    reportedDate.getFullYear(),
    reportedDate.getMonth(),
    reportedDate.getDate()
  )
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())

  const diffMs = todayUtc - reportedUtc
  if (diffMs < 0) {
    return 0
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

const getClaimAgeCategory = (ageDays: number | null): string => {
  if (ageDays === null) {
    return ''
  }
  if (ageDays <= 30) {
    return '0 to 30'
  }
  if (ageDays <= 60) {
    return '31 to 60'
  }
  return '>60'
}

const findColumnKey = (row: Record<string, unknown>, candidateNames: string[]): string | null => {
  const normalizedMap = new Map<string, string>()

  Object.keys(row).forEach((key) => {
    normalizedMap.set(key.trim().toLowerCase(), key)
  })

  for (const candidate of candidateNames) {
    const resolved = normalizedMap.get(candidate.trim().toLowerCase())
    if (resolved) {
      return resolved
    }
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

    const claimAgeDays = getClaimAgeDays(normalized[claimReportedDateKey])
    normalized['Claim Age (Days)'] = claimAgeDays ?? ''
    normalized['Claim Age Category'] = getClaimAgeCategory(claimAgeDays)
  }

  const examinerCodeKey = findColumnKey(normalized, [
    'Examiner ID Code',
    'Examiner Id Code',
    'Examiner IDCode',
    'Examiner IdCode',
    'Examiner Code',
    'Examiner',
  ])
  const componentAdjusterCodeKey = findColumnKey(normalized, [
    'Claim Component Adjuster Code',
    'Component Adjuster Code',
    'Component Adjuster',
  ])

  const examinerCode = examinerCodeKey ? String(normalized[examinerCodeKey] ?? '').trim() : ''
  const componentAdjusterCode = componentAdjusterCodeKey
    ? String(normalized[componentAdjusterCodeKey] ?? '').trim()
    : ''

  const shouldUseExaminerCode = examinerCode.length > 0 && examinerCode !== '~'
  normalized['Adjuster'] = shouldUseExaminerCode ? examinerCode : componentAdjusterCode

  return normalized
}

function App() {
  const isAiSummaryEnabled = Boolean(import.meta.env.VITE_OPENAI_API_KEY)
  const [isAiInfoOpen, setIsAiInfoOpen] = useState(false)
  const aiStatusRef = useRef<HTMLDivElement | null>(null)
  const [data, setData] = useState<ExcelData | null>(null)
  const [mainFileName, setMainFileName] = useState<string>('')
  const [liabilityData, setLiabilityData] = useState<any[]>([])
  const [liabilityFileName, setLiabilityFileName] = useState<string>('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [filteredData, setFilteredData] = useState<any[] | null>(null)
  const [viewMode, setViewMode] = useState<'charts' | 'table' | 'pivot' | 'matrix'>('charts')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchColumn, setSearchColumn] = useState<string>('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [isVisualizationCollapsed, setIsVisualizationCollapsed] = useState(false)
  const [panelFilters, setPanelFilters] = useState<PanelFiltersState>({
    selectedValues: {},
    claimReportedDateRange: { start: '', end: '' },
  })
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false)
  const [matrixDrilldownTarget, setMatrixDrilldownTarget] = useState<MatrixDrilldownTarget | null>(null)
  const matrixSectionRef = useRef<HTMLDivElement | null>(null)

  const filterRows = (
    sheetData: any[],
    nextSearchTerm: string,
    nextSearchColumn?: string,
    nextPanelFilters?: PanelFiltersState,
    ignoredFilterFields: string[] = []
  ) => {
    let filtered = [...sheetData]
    const ignored = new Set(ignoredFilterFields)

    if (nextPanelFilters && Object.keys(nextPanelFilters.selectedValues).length > 0) {
      Object.entries(nextPanelFilters.selectedValues).forEach(([fieldName, selectedValues]: any) => {
        if (ignored.has(fieldName)) {
          return
        }

        if (selectedValues.length > 0) {
          filtered = filtered.filter((row) =>
            selectedValues.includes(String(row[fieldName]))
          )
        }
      })
    }

    if (nextPanelFilters) {
      const { start, end } = nextPanelFilters.claimReportedDateRange
      if (start && end) {
        filtered = filtered.filter((row) => {
          const rowDate = String(row['Claim Reported Date'] ?? '')
          return rowDate >= start && rowDate <= end
        })
      }
    }

    if (nextSearchTerm) {
      filtered = filtered.filter((row) => {
        if (nextSearchColumn) {
          return String(row[nextSearchColumn])
            .toLowerCase()
            .includes(nextSearchTerm.toLowerCase())
        }
        return Object.values(row).some((value) =>
          String(value).toLowerCase().includes(nextSearchTerm.toLowerCase())
        )
      })
    }

    return filtered
  }

  useEffect(() => {
    if (viewMode !== 'matrix' || !matrixDrilldownTarget) {
      return
    }

    matrixSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [viewMode, matrixDrilldownTarget])

  useEffect(() => {
    if (!isAiInfoOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!aiStatusRef.current) {
        return
      }

      if (!aiStatusRef.current.contains(event.target as Node)) {
        setIsAiInfoOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isAiInfoOpen])

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
        setMainFileName(file.name)
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

  const handleLiabilityFileUpload = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const result = e.target?.result
        if (!result) {
          throw new Error('Unable to read file data')
        }

        const workbook = XLSX.read(result, { type: 'binary' })
        const combinedRows = workbook.SheetNames.flatMap((sheetName) => {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: '',
          }) as Record<string, unknown>[]

          return rows.map((row) => normalizeDateFieldsInRow(row))
        })

        setLiabilityData(combinedRows)
        setLiabilityFileName(file.name)
      } catch (error) {
        alert('Error reading liability file: ' + (error as Error).message)
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleFilter = (term: string, column?: string) => {
    if (!data || !activeSheet) return
    setSearchTerm(term)
    setSearchColumn(column || '')
    applyAllFilters(data[activeSheet], term, column, panelFilters)
  }

  const handlePanelFilterChange = (filters: PanelFiltersState) => {
    setPanelFilters(filters)
    if (!data || !activeSheet) return
    applyAllFilters(data[activeSheet], searchTerm, searchColumn || undefined, filters)
  }

  const applyAllFilters = (
    sheetData: any[],
    searchTerm: string,
    searchColumn?: string,
    panelFilters?: PanelFiltersState
  ) => {
    setFilteredData(filterRows(sheetData, searchTerm, searchColumn, panelFilters))
  }

  const handleExport = () => {
    if (!filteredData) return

    const worksheet = XLSX.utils.json_to_sheet(filteredData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export')
    XLSX.writeFile(workbook, 'dashboard-export.xlsx')
  }

  const handleMetricDrilldown = (target: MatrixDrilldownTarget) => {
    setMatrixDrilldownTarget(target)
    setViewMode('matrix')
  }

  const currentData = activeSheet && data ? data[activeSheet] : null

  const selectedAdjusters = useMemo(() => {
    const adjusterValues = Object.entries(panelFilters.selectedValues)
      .filter(([fieldName]) => isAdjusterFieldName(fieldName))
      .flatMap(([, values]) => values)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)

    return Array.from(new Set(adjusterValues))
  }, [panelFilters.selectedValues])

  const peerComparisonData = useMemo(() => {
    if (!currentData) {
      return [] as any[]
    }

    const ignoredFields = Object.keys(panelFilters.selectedValues).filter((fieldName) =>
      isAdjusterFieldName(fieldName)
    )

    return filterRows(
      currentData,
      searchTerm,
      searchColumn || undefined,
      panelFilters,
      ignoredFields
    )
  }, [currentData, panelFilters, searchTerm, searchColumn])

  return (
    <div className="app">
      <header className="header">
        <h1>📊 Claims 101</h1>
        <p>Upload, analyze, and visualize your Excel data</p>
        <div ref={aiStatusRef}>
          <button
            type="button"
            className={`ai-status-badge ${isAiSummaryEnabled ? 'enabled' : 'disabled'}`}
            onClick={() => setIsAiInfoOpen((prev) => !prev)}
            aria-expanded={isAiInfoOpen}
            aria-controls="ai-summary-config-help"
          >
            AI Summary: {isAiSummaryEnabled ? 'Enabled' : 'Disabled'}
          </button>
          {isAiInfoOpen && (
            <div id="ai-summary-config-help" className="ai-status-tooltip" role="status">
              <p>Set VITE_OPENAI_API_KEY to enable live AI summaries.</p>
              <p>Optional: VITE_OPENAI_MODEL and VITE_OPENAI_API_URL.</p>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        <FileUpload
          onFileUpload={handleFileUpload}
          onLiabilityFileUpload={handleLiabilityFileUpload}
          fileName={mainFileName}
          liabilityFileName={liabilityFileName}
        />

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
                      setPanelFilters({
                        selectedValues: {},
                        claimReportedDateRange: { start: '', end: '' },
                      })
                    }}
                  >
                    {sheet}
                  </button>
                ))}
              </div>

              {currentData && (
                <>
                  <KeyMetrics
                    data={filteredData || currentData}
                    onDrillDown={handleMetricDrilldown}
                  />

                  <AdjusterSummary
                    data={filteredData || currentData}
                    peerData={peerComparisonData}
                    selectedAdjusters={selectedAdjusters}
                  />

                  <section className="visualization-section">
                    <div className="kpi-header">
                      <h2>Visualization</h2>
                      <button
                        type="button"
                        className="kpi-toggle"
                        onClick={() => setIsVisualizationCollapsed((prev) => !prev)}
                      >
                        {isVisualizationCollapsed ? 'Show' : 'Hide'}
                      </button>
                    </div>

                    {!isVisualizationCollapsed && (
                      <>
                        <p className="kpi-description">
                          Explore claims data through charts, table views, pivot analysis, and matrix reporting.
                        </p>

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
                          <button
                            className={`toggle-btn ${viewMode === 'matrix' ? 'active' : ''}`}
                            onClick={() => setViewMode('matrix')}
                          >
                            🧮 Matrix Report
                          </button>
                        </div>

                        {viewMode === 'charts' && (
                          <div className="chart-section">
                            <Charts
                              data={filteredData || currentData}
                              xAxisKey="Claim Reported Month-Year"
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

                        {viewMode === 'matrix' && (
                          <div className="table-section" ref={matrixSectionRef}>
                            <MatrixReport
                              data={filteredData || currentData}
                              drilldownTarget={matrixDrilldownTarget}
                              onClearDrilldown={() => setMatrixDrilldownTarget(null)}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  <LiabilityStandalonePanel
                    data={liabilityData}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {!data && (
          <LiabilityStandalonePanel
            data={liabilityData}
          />
        )}
      </main>
    </div>
  )
}

export default App
