import { useEffect, useMemo, useState } from 'react'

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

const getStatusBucket = (value: unknown): 'open' | 'closed' | 'other' => {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (/\bclosed\b/.test(normalized)) {
    return 'closed'
  }

  if (/\bopen\b/.test(normalized) || /\breopen\b/.test(normalized) || /\breopened\b/.test(normalized)) {
    return 'open'
  }

  return 'other'
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

  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data])

  const defaultClaimNumberColumn = findColumn(columns, ['Claim Number']) ?? ''
  const defaultDirectLossPaidColumn = findColumn(columns, [
    'Direct Loss Paid ITD',
    'Direct Loss Paid',
  ]) ?? ''
  const defaultReserveOutstandingColumn = findColumn(columns, [
    'Direct Loss Reserve Outstanding',
    'Reserve Outstanding',
  ]) ?? ''
  const defaultStatusColumn = findColumn(columns, ['Claim Status', 'Status']) ?? ''

  const [claimNumberColumn, setClaimNumberColumn] = useState<string>(defaultClaimNumberColumn)
  const [directLossPaidColumn, setDirectLossPaidColumn] = useState<string>(defaultDirectLossPaidColumn)
  const [reserveOutstandingColumn, setReserveOutstandingColumn] = useState<string>(
    defaultReserveOutstandingColumn
  )
  const [statusColumn, setStatusColumn] = useState<string>(defaultStatusColumn)

  useEffect(() => {
    if (!claimNumberColumn || !columns.includes(claimNumberColumn)) {
      setClaimNumberColumn(defaultClaimNumberColumn)
    }
    if (!directLossPaidColumn || !columns.includes(directLossPaidColumn)) {
      setDirectLossPaidColumn(defaultDirectLossPaidColumn)
    }
    if (!reserveOutstandingColumn || !columns.includes(reserveOutstandingColumn)) {
      setReserveOutstandingColumn(defaultReserveOutstandingColumn)
    }
    if (!statusColumn || !columns.includes(statusColumn)) {
      setStatusColumn(defaultStatusColumn)
    }
  }, [
    columns,
    claimNumberColumn,
    directLossPaidColumn,
    reserveOutstandingColumn,
    statusColumn,
    defaultClaimNumberColumn,
    defaultDirectLossPaidColumn,
    defaultReserveOutstandingColumn,
    defaultStatusColumn,
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

  const openUnpaidClaimCount = (() => {
    if (!statusColumn) {
      return 0
    }

    const paidColumnForUnpaidCheck = directLossPaidColumn
    const openUnpaidClaimIds = new Set<string>()
    let openUnpaidRowCount = 0

    data.forEach((row) => {
      const statusBucket = getStatusBucket(row[statusColumn])
      if (statusBucket !== 'open') {
        return
      }

      const paidAmount = paidColumnForUnpaidCheck ? parseNumber(row[paidColumnForUnpaidCheck]) : 0
      if (paidAmount > 0) {
        return
      }

      if (claimNumberColumn) {
        const claimId = String(row[claimNumberColumn] ?? '').trim()
        if (claimId) {
          openUnpaidClaimIds.add(claimId)
          return
        }
      }

      openUnpaidRowCount += 1
    })

    if (claimNumberColumn) {
      return openUnpaidClaimIds.size
    }

    return openUnpaidRowCount
  })()

  const closedUnpaidClaimCount = (() => {
    if (!statusColumn) {
      return 0
    }

    const paidColumnForUnpaidCheck = directLossPaidColumn
    const closedUnpaidClaimIds = new Set<string>()
    let closedUnpaidRowCount = 0

    data.forEach((row) => {
      const statusBucket = getStatusBucket(row[statusColumn])
      if (statusBucket !== 'closed') {
        return
      }

      const paidAmount = paidColumnForUnpaidCheck ? parseNumber(row[paidColumnForUnpaidCheck]) : 0
      if (paidAmount > 0) {
        return
      }

      if (claimNumberColumn) {
        const claimId = String(row[claimNumberColumn] ?? '').trim()
        if (claimId) {
          closedUnpaidClaimIds.add(claimId)
          return
        }
      }

      closedUnpaidRowCount += 1
    })

    if (claimNumberColumn) {
      return closedUnpaidClaimIds.size
    }

    return closedUnpaidRowCount
  })()

  const openWithPayClaimCount = (() => {
    if (!statusColumn || !directLossPaidColumn) {
      return 0
    }

    const openWithPayClaimIds = new Set<string>()
    let openWithPayRowCount = 0

    data.forEach((row) => {
      const statusBucket = getStatusBucket(row[statusColumn])
      if (statusBucket !== 'open') {
        return
      }

      const paidAmount = parseNumber(row[directLossPaidColumn])
      if (paidAmount <= 0) {
        return
      }

      if (claimNumberColumn) {
        const claimId = String(row[claimNumberColumn] ?? '').trim()
        if (claimId) {
          openWithPayClaimIds.add(claimId)
          return
        }
      }

      openWithPayRowCount += 1
    })

    if (claimNumberColumn) {
      return openWithPayClaimIds.size
    }

    return openWithPayRowCount
  })()

  const openWithPayFinancials = (() => {
    if (!statusColumn || !directLossPaidColumn) {
      return { paidItdTotal: 0, reserveOutstandingTotal: 0 }
    }

    const seenClaimIds = new Set<string>()
    let paidItdTotal = 0
    let reserveOutstandingTotal = 0

    data.forEach((row) => {
      const statusBucket = getStatusBucket(row[statusColumn])
      if (statusBucket !== 'open') {
        return
      }

      const paidAmount = parseNumber(row[directLossPaidColumn])
      if (paidAmount <= 0) {
        return
      }

      if (claimNumberColumn) {
        const claimId = String(row[claimNumberColumn] ?? '').trim()
        if (!claimId || seenClaimIds.has(claimId)) {
          return
        }
        seenClaimIds.add(claimId)
      }

      paidItdTotal += paidAmount
      reserveOutstandingTotal += reserveOutstandingColumn ? parseNumber(row[reserveOutstandingColumn]) : 0
    })

    return {
      paidItdTotal,
      reserveOutstandingTotal,
    }
  })()

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

      <div className="kpi-field-controls">
        <div className="kpi-field-group">
          <label htmlFor="kpi-claim-id-column">Claim Identifier Field</label>
          <select
            id="kpi-claim-id-column"
            value={claimNumberColumn}
            onChange={(e) => setClaimNumberColumn(e.target.value)}
            className="kpi-field-select"
          >
            <option value="">No claim ID (count rows)</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="kpi-field-group">
          <label htmlFor="kpi-status-column">Status Field</label>
          <select
            id="kpi-status-column"
            value={statusColumn}
            onChange={(e) => setStatusColumn(e.target.value)}
            className="kpi-field-select"
          >
            <option value="">No status field</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="kpi-field-group">
          <label htmlFor="kpi-paid-column">Paid ITD Field</label>
          <select
            id="kpi-paid-column"
            value={directLossPaidColumn}
            onChange={(e) => setDirectLossPaidColumn(e.target.value)}
            className="kpi-field-select"
          >
            <option value="">No paid field</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="kpi-field-group">
          <label htmlFor="kpi-reserve-column">Reserve Outstanding Field</label>
          <select
            id="kpi-reserve-column"
            value={reserveOutstandingColumn}
            onChange={(e) => setReserveOutstandingColumn(e.target.value)}
            className="kpi-field-select"
          >
            <option value="">No reserve field</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!collapsed && (
        <>
          <h3 className="kpi-row-title">Financial Metrics</h3>
          <div className="kpi-grid kpi-grid-money">
            <article className="kpi-card kpi-card-open-with-pay-paid">
              <p className="kpi-label">Open With Pay - Paid ITD</p>
              <p className="kpi-value">{formatCurrency(openWithPayFinancials.paidItdTotal)}</p>
            </article>

            <article className="kpi-card kpi-card-open-with-pay-reserve">
              <p className="kpi-label">Open With Pay - Direct Loss Reserve Outstanding</p>
              <p className="kpi-value">{formatCurrency(openWithPayFinancials.reserveOutstandingTotal)}</p>
            </article>

            <article className="kpi-card kpi-card-total-paid">
              <p className="kpi-label">Total Direct Loss Paid ITD</p>
              <p className="kpi-value">{formatCurrency(totalDirectLossPaid)}</p>
            </article>

            <article className="kpi-card kpi-card-total-reserve">
              <p className="kpi-label">Direct Loss Reserve Outstanding</p>
              <p className="kpi-value">{formatCurrency(totalDirectLossReserveOutstanding)}</p>
            </article>
          </div>

          <h3 className="kpi-row-title">Claim Counts</h3>
          <div className="kpi-grid kpi-grid-counts">
            <article className="kpi-card kpi-card-claim-count">
              <p className="kpi-label">Claim Count</p>
              <p className="kpi-value">{formatInteger(claimCount)}</p>
            </article>

            <article className="kpi-card kpi-card-open-without-pay">
              <p className="kpi-label">Claims Open Without Pay</p>
              <p className="kpi-value">{formatInteger(openUnpaidClaimCount)}</p>
            </article>

            <article className="kpi-card kpi-card-closed-without-pay">
              <p className="kpi-label">Claims Closed Without Pay</p>
              <p className="kpi-value">{formatInteger(closedUnpaidClaimCount)}</p>
            </article>

            <article className="kpi-card kpi-card-open-with-pay-count">
              <p className="kpi-label">Claims Open With Pay</p>
              <p className="kpi-value">{formatInteger(openWithPayClaimCount)}</p>
            </article>
          </div>
        </>
      )}
    </section>
  )
}
