import { useMemo, useState } from 'react'
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

export default function Charts({ data, xAxisKey, numericKeys }: ChartsProps) {
  const [selectedNumericKeys, setSelectedNumericKeys] = useState<string[]>([])
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('')

  const { allNumericColumns, stringColumns, xAxis } = useMemo(() => {
    if (!data || data.length === 0)
      return { allNumericColumns: [], stringColumns: [], xAxis: '' }

    const isDateColumn = (col: string) => {
      const normalized = col.trim().toLowerCase()
      return normalized.includes('date')
    }

    // Find all numeric columns (exclude Claim Number and any date-like fields)
    const columns = Object.keys(data[0])
    const numericColumns = columns.filter((col) => {
      const normalized = col.trim().toLowerCase()
      return (
        normalized !== 'claim number' &&
        !isDateColumn(col) &&
        data.some((row) => typeof row[col] === 'number')
      )
    })
    
    // Add Count as a virtual metric
    numericColumns.push('Count')

    // Include any date-like column in category grouping, even if values are numeric.
    const stringCols = columns.filter((col) => {
      const isDateField = isDateColumn(col)
      const isStringType = data.some((row) => typeof row[col] === 'string')
      return (isDateField || (col !== 'Loss cause' && isStringType))
    })

    // Use provided xAxisKey or find first string column
    let xAxisCol = xAxisKey || stringCols[0] || columns[0]

    return {
      numericData: data.slice(0, 10),
      allNumericColumns: numericColumns,
      stringColumns: stringCols,
      xAxis: xAxisCol,
    }
  }, [data, xAxisKey])

  // Group and aggregate data by selected category
  const groupedData = useMemo(() => {
    if (!selectedGroupBy || !data || data.length === 0) {
      return data.slice(0, 10)
    }

    const grouped: { [key: string]: any } = {}

    // Group data by the selected category
    data.forEach((row) => {
      const groupKey = String(row[selectedGroupBy])
      if (!grouped[groupKey]) {
        grouped[groupKey] = { [selectedGroupBy]: groupKey, Count: 0 }
        // Initialize numeric columns
        allNumericColumns.forEach((col) => {
          grouped[groupKey][col] = 0
        })
      }
      // Increment count for this group
      grouped[groupKey]['Count'] += 1
      // Sum numeric values
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
  }, [data, selectedGroupBy, allNumericColumns])

  // Initialize selected keys if not set
  useMemo(() => {
    if (selectedNumericKeys.length === 0 && numericKeys && numericKeys.length > 0) {
      setSelectedNumericKeys(numericKeys)
    } else if (
      selectedNumericKeys.length === 0 &&
      allNumericColumns.length > 0
    ) {
      setSelectedNumericKeys(allNumericColumns.slice(0, 2))
    }
  }, [allNumericColumns, numericKeys, selectedNumericKeys])

  if (!groupedData || allNumericColumns.length === 0) {
    return (
      <div className="charts-container">
        <p>No numeric data available for charts</p>
      </div>
    )
  }

  const handleColumnToggle = (col: string) => {
    setSelectedNumericKeys((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    )
  }

  return (
    <div className="charts-container">
      <h2>Visualizations</h2>

      <div className="chart-column-selector">
        <div className="selector-row">
          <div className="selector-group">
            <label>Group by Category:</label>
            <select
              value={selectedGroupBy}
              onChange={(e) => setSelectedGroupBy(e.target.value)}
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
