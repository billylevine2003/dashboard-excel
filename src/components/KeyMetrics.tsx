import { useState } from 'react'

interface KeyMetricsProps {
  data: any[]
}

const normalize = (value: string): string => value.trim().toLowerCase()

const findColumn = (columns: string[], candidates: string[]): string | null => {
  const normalizedCandidates = candidates.map((candidate) => normalize(candidate))

  for (const column of columns) {
    const normalizedColumn = normalize(column)
    if (normalizedCandidates.some((candidate) => normalizedColumn === candidate)) {
      return column
    }
  }

  for (const column of columns) {
    const normalizedColumn = normalize(column)
    if (normalizedCandidates.some((candidate) => normalizedColumn.includes(candidate))) {
      return column
    }
  }

  return null
}

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

export default function KeyMetrics({ data }: KeyMetricsProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!data || data.length === 0) {
    return null
  }

  const columns = Object.keys(data[0])
  const claimNumberColumn = findColumn(columns, ['Claim Number'])
  const directLossPaidColumn = findColumn(columns, [
    'Direct Loss Paid ITD',
    'Direct Loss Paid',
  ])
  const reserveOutstandingColumn = findColumn(columns, [
    'Direct Loss Reserve Outstanding',
    'Reserve Outstanding',
  ])

  const claimCount = claimNumberColumn
    ? new Set(
        data
          .map((row) => row[claimNumberColumn])
          .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      ).size
    : data.length

  const totalDirectLossPaid = directLossPaidColumn
    ? data.reduce((sum, row) => sum + parseNumber(row[directLossPaidColumn]), 0)
    : 0

  const totalDirectLossReserveOutstanding = reserveOutstandingColumn
    ? data.reduce((sum, row) => sum + parseNumber(row[reserveOutstandingColumn]), 0)
    : 0

  return (
    <section className="kpi-section">
      <div className="kpi-header">
        <h2>Key Metrics</h2>
        <button
          type="button"
          className="kpi-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && <div className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Claim Count</p>
          <p className="kpi-value">{formatInteger(claimCount)}</p>
        </article>

        <article className="kpi-card">
          <p className="kpi-label">Total Direct Loss Paid ITD</p>
          <p className="kpi-value">{formatCurrency(totalDirectLossPaid)}</p>
        </article>

        <article className="kpi-card">
          <p className="kpi-label">Direct Loss Reserve Outstanding</p>
          <p className="kpi-value">{formatCurrency(totalDirectLossReserveOutstanding)}</p>
        </article>
      </div>}
    </section>
  )
}
