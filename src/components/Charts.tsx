import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface ChartsProps {
  data: any[]
  xAxisKey?: string
  numericKeys?: string[]
}

type ChartPreset = 'financial' | 'status' | 'volume' | 'custom'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1']

const parseDateLabel = (value: string): number | null => {
  const trimmed = value.trim()

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) {
    const timestamp = new Date(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T00:00:00Z`).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }

  const isoMonth = trimmed.match(/^(\d{4})-(\d{2})$/)
  if (isoMonth) {
    const timestamp = new Date(`${isoMonth[1]}-${isoMonth[2]}-01T00:00:00Z`).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }

  const monthYear = trimmed.match(/^([A-Za-z]{3,9})\s+([0-9]{2,4})$/)
  if (monthYear) {
    const yearPart = monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2]
    const timestamp = new Date(`${monthYear[1]} 1, ${yearPart}`).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return parsed
  }

  return null
}

const normalize = (value: string): string => value.trim().toLowerCase()

const findMatchingColumn = (columns: string[], candidate: string): string | null => {
  const normalizedCandidate = normalize(candidate)

  const exact = columns.find((col) => normalize(col) === normalizedCandidate)
  if (exact) {
    return exact
  }

  const partial = columns.find((col) => normalize(col).includes(normalizedCandidate))
  return partial || null
}

const isExcludedVisualizationMetric = (columnName: string): boolean => {
  const normalized = normalize(columnName)
  const exactExcluded = new Set([
    'claimant number',
    'claimant link',
    'at fault indicator',
    'loss paid',
    'loss initial reserve',
    'loss reserve change',
  ])

  return exactExcluded.has(normalized)
}

export default function Charts({ data, xAxisKey, numericKeys }: ChartsProps) {
  const [selectedNumericKeys, setSelectedNumericKeys] = useState<string[]>([])
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('')
  const [selectedPreset, setSelectedPreset] = useState<ChartPreset>('financial')

  const { allNumericColumns, stringColumns, xAxis } = useMemo<{
    allNumericColumns: string[]
    stringColumns: string[]
    xAxis: string
  }>(() => {
    if (!data || data.length === 0) {
      return { allNumericColumns: [], stringColumns: [], xAxis: '' }
    }

    const isDateColumn = (col: string) => {
      const normalized = col.trim().toLowerCase()
      return normalized.includes('date')
    }

    const columns = Object.keys(data[0])
    const numericColumns = columns.filter((col) => {
      const normalized = col.trim().toLowerCase()
      return (
        normalized !== 'claim number' &&
        !isExcludedVisualizationMetric(col) &&
        !isDateColumn(col) &&
        data.some((row) => typeof row[col] === 'number')
      )
    })

    numericColumns.push('Count')

    const stringCols = columns.filter((col) => {
      const isDateField = isDateColumn(col)
      const isStringType = data.some((row) => typeof row[col] === 'string')
      return isDateField || (col !== 'Loss cause' && isStringType)
    })

    const xAxisCol = xAxisKey || stringCols[0] || columns[0]

    return {
      allNumericColumns: numericColumns,
      stringColumns: stringCols,
      xAxis: xAxisCol,
    }
  }, [data, xAxisKey])

  const defaultGroupBy = useMemo(() => {
    if (!stringColumns.length) {
      return ''
    }

    if (xAxisKey) {
      const matchedXAxis = findMatchingColumn(stringColumns, xAxisKey)
      if (matchedXAxis) {
        return matchedXAxis
      }
    }

    const preferred = [
      'claim reported month-year',
      'claim reported date',
      'claim age category',
      'claim status',
    ]

    for (const candidate of preferred) {
      const matched = findMatchingColumn(stringColumns, candidate)
      if (matched) {
        return matched
      }
    }

    return stringColumns[0]
  }, [stringColumns, xAxisKey])

  const defaultNumericSelection = useMemo(() => {
    const defaultsFromProps = (numericKeys || [])
      .map((candidate) => findMatchingColumn(allNumericColumns, candidate))
      .filter((value): value is string => Boolean(value))

    if (defaultsFromProps.length > 0) {
      return Array.from(new Set(defaultsFromProps))
    }

    const preferred = ['Count', 'Direct Loss Paid ITD', 'Direct Loss Reserve Outstanding']
      .map((candidate) => findMatchingColumn(allNumericColumns, candidate))
      .filter((value): value is string => Boolean(value))

    if (preferred.length > 0) {
      return Array.from(new Set(preferred))
    }

    return allNumericColumns.slice(0, 2)
  }, [allNumericColumns, numericKeys])

  const presetDefaults = useMemo(() => {
    const findFirstAvailable = (candidates: string[], source: string[]): string => {
      for (const candidate of candidates) {
        const match = findMatchingColumn(source, candidate)
        if (match) {
          return match
        }
      }
      return source[0] || ''
    }

    const findMetrics = (candidates: string[]): string[] => {
      const matches = candidates
        .map((candidate) => findMatchingColumn(allNumericColumns, candidate))
        .filter((value): value is string => Boolean(value))
      return Array.from(new Set(matches))
    }

    const fallbackGroup = defaultGroupBy || stringColumns[0] || ''

    const financialMetrics = findMetrics([
      'Direct Loss Paid ITD',
      'Direct Loss Reserve Outstanding',
      'Count',
    ])

    const statusMetrics = findMetrics(['Count', 'Direct Loss Paid ITD'])
    const volumeMetrics = findMetrics(['Count', 'Direct Loss Paid ITD'])

    return {
      financial: {
        groupBy:
          findFirstAvailable(
            ['Claim Reported Month-Year', 'Claim Reported Date', 'Claim Status', 'Claim Age Category'],
            stringColumns
          ) || fallbackGroup,
        metrics: financialMetrics.length > 0 ? financialMetrics : defaultNumericSelection,
      },
      status: {
        groupBy: findFirstAvailable(['Claim Status', 'Claim Age Category'], stringColumns) || fallbackGroup,
        metrics: statusMetrics.length > 0 ? statusMetrics : defaultNumericSelection,
      },
      volume: {
        groupBy:
          findFirstAvailable(
            ['Claim Reported Month-Year', 'Claim Reported Date', 'Claim Age Category'],
            stringColumns
          ) || fallbackGroup,
        metrics: volumeMetrics.length > 0 ? volumeMetrics : defaultNumericSelection,
      },
    }
  }, [allNumericColumns, defaultGroupBy, defaultNumericSelection, stringColumns])

  useEffect(() => {
    if (selectedPreset === 'custom') {
      if (selectedGroupBy && !stringColumns.includes(selectedGroupBy)) {
        setSelectedGroupBy('')
      }

      const stillValid = selectedNumericKeys.filter((key) => allNumericColumns.includes(key))
      if (stillValid.length !== selectedNumericKeys.length) {
        setSelectedNumericKeys(stillValid)
      }
      return
    }

    const preset = presetDefaults[selectedPreset]
    if (preset.groupBy) {
      setSelectedGroupBy(preset.groupBy)
    }
    setSelectedNumericKeys(preset.metrics)
  }, [allNumericColumns, presetDefaults, selectedGroupBy, selectedNumericKeys, selectedPreset, stringColumns])

  useEffect(() => {
    if (selectedPreset === 'custom') {
      return
    }

    if (!selectedGroupBy || !stringColumns.includes(selectedGroupBy)) {
      setSelectedGroupBy(defaultGroupBy)
    }
  }, [defaultGroupBy, selectedGroupBy, selectedPreset, stringColumns])

  useEffect(() => {
    if (selectedPreset === 'custom') {
      return
    }

    const stillValid = selectedNumericKeys.filter((key) => allNumericColumns.includes(key))
    if (stillValid.length > 0 && stillValid.length === selectedNumericKeys.length) {
      return
    }
    if (stillValid.length > 0) {
      setSelectedNumericKeys(stillValid)
      return
    }
    setSelectedNumericKeys(defaultNumericSelection)
  }, [allNumericColumns, defaultNumericSelection, selectedNumericKeys, selectedPreset])

  const groupedData = useMemo(() => {
    if (!selectedGroupBy || !data || data.length === 0) {
      return data.slice(0, 10)
    }

    const grouped: { [key: string]: any } = {}

    data.forEach((row) => {
      const groupKey = String(row[selectedGroupBy])
      if (!grouped[groupKey]) {
        grouped[groupKey] = { [selectedGroupBy]: groupKey, Count: 0 }
        allNumericColumns.forEach((col) => {
          grouped[groupKey][col] = 0
        })
      }
      grouped[groupKey].Count += 1
      allNumericColumns.forEach((col) => {
        if (typeof row[col] === 'number') {
          grouped[groupKey][col] += row[col]
        }
      })
    })

    const rows = Object.values(grouped)
    const isDateLikeGroup = /date|month|year/i.test(selectedGroupBy)

    return rows.sort((a: any, b: any) => {
      const aLabel = String(a[selectedGroupBy] ?? '')
      const bLabel = String(b[selectedGroupBy] ?? '')

      if (isDateLikeGroup) {
        const aDate = parseDateLabel(aLabel)
        const bDate = parseDateLabel(bLabel)
        if (aDate !== null && bDate !== null) {
          return aDate - bDate
        }
      }

      const aNumber = Number(aLabel)
      const bNumber = Number(bLabel)
      const bothNumbers = !Number.isNaN(aNumber) && !Number.isNaN(bNumber)
      if (bothNumbers) {
        return aNumber - bNumber
      }

      return aLabel.localeCompare(bLabel, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    })
  }, [allNumericColumns, data, selectedGroupBy])

  const handleColumnToggle = (col: string) => {
    setSelectedPreset('custom')
    setSelectedNumericKeys((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    )
  }

  const handleGroupByChange = (value: string) => {
    setSelectedPreset('custom')
    setSelectedGroupBy(value)
  }

  const handlePresetChange = (value: ChartPreset) => {
    setSelectedPreset(value)
  }

  if (!groupedData || allNumericColumns.length === 0) {
    return (
      <div className="charts-container">
        <p>No numeric data available for charts</p>
      </div>
    )
  }

  return (
    <div className="charts-container">
      <h2>Visualizations</h2>

      <div className="chart-column-selector">
        <div className="selector-row">
          <div className="selector-group">
            <label>Chart Preset:</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as ChartPreset)}
              className="category-select"
            >
              <option value="financial">Financial View</option>
              <option value="status">Status View</option>
              <option value="volume">Volume Trend View</option>
              <option value="custom">Custom (Preserve Manual)</option>
            </select>
          </div>

          <div className="selector-group">
            <label>Group by Category:</label>
            <select
              value={selectedGroupBy}
              onChange={(e) => handleGroupByChange(e.target.value)}
              className="category-select"
            >
              <option value="">None (Show all data)</option>
              {stringColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>Select metrics to visualize:</label>
        <div className="column-checkboxes">
          {allNumericColumns.map((col) => (
            <label key={col} className="column-checkbox-label">
              <input
                type="checkbox"
                checked={selectedNumericKeys.includes(col)}
                onChange={() => handleColumnToggle(col)}
              />
              {col}
            </label>
          ))}
        </div>
      </div>

      {selectedNumericKeys.length === 0 ? (
        <p className="no-columns-message">
          Please select at least one column to visualize
        </p>
      ) : (
        <>
          <div className="chart">
            <h3>Bar Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={groupedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={selectedGroupBy || xAxis} />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedNumericKeys.map((col, idx) => (
                  <Bar
                    key={col}
                    dataKey={col}
                    fill={COLORS[idx % COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart">
            <h3>Line Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={groupedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={selectedGroupBy || xAxis} />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedNumericKeys.map((col, idx) => (
                  <Line
                    key={col}
                    type="monotone"
                    dataKey={col}
                    stroke={COLORS[idx % COLORS.length]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {selectedNumericKeys.length > 0 && (
            <div className="chart">
              <h3>Pie Chart - {selectedNumericKeys[0]}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={groupedData}
                    dataKey={selectedNumericKeys[0]}
                    nameKey={selectedGroupBy || xAxis}
                    cx="50%"
                    cy="50%"
                    label
                  >
                    {groupedData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
