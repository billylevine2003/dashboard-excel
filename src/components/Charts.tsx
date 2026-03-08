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

export default function Charts({ data, xAxisKey, numericKeys }: ChartsProps) {
  const [selectedNumericKeys, setSelectedNumericKeys] = useState<string[]>([])
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('')

  const { numericData, allNumericColumns, stringColumns, xAxis } = useMemo(() => {
    if (!data || data.length === 0)
      return { numericData: null, allNumericColumns: [], stringColumns: [], xAxis: '' }

    // Find all numeric columns
    const columns = Object.keys(data[0])
    const numericColumns = columns.filter((col) => {
      return data.some((row) => typeof row[col] === 'number')
    })

    // Find all string columns for grouping
    const stringCols = columns.filter((col) => {
      return data.some((row) => typeof row[col] === 'string')
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

  if (!numericData || allNumericColumns.length === 0) {
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
              <BarChart data={numericData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxis} />
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
              <LineChart data={numericData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xAxis} />
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
                    data={numericData}
                    dataKey={selectedNumericKeys[0]}
                    nameKey={xAxis}
                    cx="50%"
                    cy="50%"
                    label
                  >
                    {numericData.map((_entry, index) => (
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
