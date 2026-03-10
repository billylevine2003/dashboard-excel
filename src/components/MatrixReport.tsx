timport { useEffect, useMemo, useState } from 'react'

interface MatrixReportProps {
  data: any[]
}

interface MatrixRow {
  adjuster: string
  openWithoutPayCount: number
  closedWithoutPayCount: number
  openWithPayCount: number
  openWithPayPaidItd: number
  openWithPayReserveOutstanding: number
}

const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase()

const isOpenStatus = (value: unknown): boolean => {
  const normalized = normalizeText(value)
  return /\bopen\b/.test(normalized) || /\breopen\b/.test(normalized) || /\breopened\b/.test(normalized)
}

const isClosedStatus = (value: unknown): boolean => {
  const normalized = normalizeText(value)
  return /\bclosed\b/.test(normalized)
}

const getStatusBucket = (value: unknown): 'open' | 'closed' | 'other' => {
  if (isClosedStatus(value)) {
    return 'closed'
  }
  if (isOpenStatus(value)) {
    return 'open'
  }
  return 'other'
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

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const findDefaultColumn = (columns: string[], options: string[]): string => {
  for (const option of options) {
    const exact = columns.find((col) => normalizeText(col) === option)
    if (exact) {
      return exact
    }
  }

  for (const option of options) {
    const partial = columns.find((col) => normalizeText(col).includes(option))
    if (partial) {
      return partial
    }
  }

  return ''
}

export default function MatrixReport({ data }: MatrixReportProps) {
  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data])

  const [adjusterColumn, setAdjusterColumn] = useState<string>(() =>
    findDefaultColumn(columns, ['claim component adjuster code', 'component adjuster', 'adjuster'])
  )
  const [statusColumn, setStatusColumn] = useState<string>(() =>
    findDefaultColumn(columns, ['claim status', 'status'])
  )
  const [claimIdColumn, setClaimIdColumn] = useState<string>(() =>
    findDefaultColumn(columns, ['claim number', 'claim id', 'claim'])
  )
  const [paidAmountColumn, setPaidAmountColumn] = useState<string>(() =>
    findDefaultColumn(columns, ['direct loss paid itd', 'direct loss paid', 'paid'])
  )
  const [reserveOutstandingColumn, setReserveOutstandingColumn] = useState<string>(() =>
    findDefaultColumn(columns, ['direct loss reserve outstanding', 'reserve outstanding'])
  )

  useEffect(() => {
    if (!columns.includes(adjusterColumn)) {
      setAdjusterColumn(
        findDefaultColumn(columns, ['claim component adjuster code', 'component adjuster', 'adjuster'])
      )
    }
    if (!columns.includes(statusColumn)) {
      setStatusColumn(findDefaultColumn(columns, ['claim status', 'status']))
    }
    if (!columns.includes(claimIdColumn)) {
      setClaimIdColumn(findDefaultColumn(columns, ['claim number', 'claim id', 'claim']))
    }
    if (!columns.includes(paidAmountColumn)) {
      setPaidAmountColumn(findDefaultColumn(columns, ['direct loss paid itd', 'direct loss paid', 'paid']))
    }
    if (!columns.includes(reserveOutstandingColumn)) {
      setReserveOutstandingColumn(
        findDefaultColumn(columns, ['direct loss reserve outstanding', 'reserve outstanding'])
      )
    }
  }, [columns, adjusterColumn, statusColumn, claimIdColumn, paidAmountColumn, reserveOutstandingColumn])

  const matrixRows = useMemo<MatrixRow[]>(() => {
    if (!adjusterColumn || !statusColumn) {
      return []
    }

    const grouped = new Map<string, MatrixRow>()
    const seenByAdjusterOpenWithoutPay = new Map<string, Set<string>>()
    const seenByAdjusterClosedWithoutPay = new Map<string, Set<string>>()
    const seenByAdjusterOpenWithPay = new Map<string, Set<string>>()

    data.forEach((row) => {
      const adjuster = String(row[adjusterColumn] ?? '-').trim() || '-'
      const status = row[statusColumn]
      const claimId = claimIdColumn
        ? String(row[claimIdColumn] ?? '').trim()
        : ''
      const rowKey = claimId || JSON.stringify(row)

      if (!grouped.has(adjuster)) {
        grouped.set(adjuster, {
          adjuster,
          openWithoutPayCount: 0,
          closedWithoutPayCount: 0,
          openWithPayCount: 0,
          openWithPayPaidItd: 0,
          openWithPayReserveOutstanding: 0,
        })
        seenByAdjusterOpenWithoutPay.set(adjuster, new Set<string>())
        seenByAdjusterClosedWithoutPay.set(adjuster, new Set<string>())
        seenByAdjusterOpenWithPay.set(adjuster, new Set<string>())
      }

      const existing = grouped.get(adjuster)
      const openWithoutPaySeen = seenByAdjusterOpenWithoutPay.get(adjuster)
      const closedWithoutPaySeen = seenByAdjusterClosedWithoutPay.get(adjuster)
      const openWithPaySeen = seenByAdjusterOpenWithPay.get(adjuster)
      if (!existing) {
        return
      }
      if (!openWithoutPaySeen || !closedWithoutPaySeen || !openWithPaySeen) {
        return
      }

      const statusBucket = getStatusBucket(status)
      const paidAmount = paidAmountColumn ? parseNumber(row[paidAmountColumn]) : 0

      if (statusBucket === 'open' && paidAmount <= 0 && !openWithoutPaySeen.has(rowKey)) {
        openWithoutPaySeen.add(rowKey)
        existing.openWithoutPayCount += 1
      }

      if (statusBucket === 'closed' && paidAmount <= 0 && !closedWithoutPaySeen.has(rowKey)) {
        closedWithoutPaySeen.add(rowKey)
        existing.closedWithoutPayCount += 1
      }

      if (statusBucket === 'open' && paidAmount > 0 && !openWithPaySeen.has(rowKey)) {
        openWithPaySeen.add(rowKey)
        existing.openWithPayCount += 1
        existing.openWithPayPaidItd += paidAmount
        existing.openWithPayReserveOutstanding += reserveOutstandingColumn
          ? parseNumber(row[reserveOutstandingColumn])
          : 0
      }
    })

    return Array.from(grouped.values()).sort((a, b) => a.adjuster.localeCompare(b.adjuster))
  }, [data, adjusterColumn, statusColumn, claimIdColumn, paidAmountColumn, reserveOutstandingColumn])

  const matrixTotals = useMemo(() =>
    matrixRows.reduce(
      (totals, row) => ({
        openWithoutPayCount: totals.openWithoutPayCount + row.openWithoutPayCount,
        closedWithoutPayCount: totals.closedWithoutPayCount + row.closedWithoutPayCount,
        openWithPayCount: totals.openWithPayCount + row.openWithPayCount,
        openWithPayPaidItd: totals.openWithPayPaidItd + row.openWithPayPaidItd,
        openWithPayReserveOutstanding:
          totals.openWithPayReserveOutstanding + row.openWithPayReserveOutstanding,
      }),
      {
        openWithoutPayCount: 0,
        closedWithoutPayCount: 0,
        openWithPayCount: 0,
        openWithPayPaidItd: 0,
        openWithPayReserveOutstanding: 0,
      }
    ),
  [matrixRows])

  if (!data || data.length === 0) {
    return <div className="table-container">No data to display</div>
  }

  return (
    <div className="table-container matrix-container">
      <h2>Matrix Report</h2>

      <div className="matrix-controls">
        <div className="pivot-control-group">
          <label htmlFor="matrix-adjuster-column">Row Field (Component Adjuster)</label>
          <select
            id="matrix-adjuster-column"
            value={adjusterColumn}
            onChange={(e) => setAdjusterColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a column...</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="matrix-status-column">Status Field</label>
          <select
            id="matrix-status-column"
            value={statusColumn}
            onChange={(e) => setStatusColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">Select a column...</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="matrix-claim-id-column">Claim Identifier Field</label>
          <select
            id="matrix-claim-id-column"
            value={claimIdColumn}
            onChange={(e) => setClaimIdColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">No claim ID (count rows)</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="matrix-paid-amount-column">Paid Amount Field</label>
          <select
            id="matrix-paid-amount-column"
            value={paidAmountColumn}
            onChange={(e) => setPaidAmountColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">No paid amount column (treat as 0)</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="pivot-control-group">
          <label htmlFor="matrix-reserve-outstanding-column">Reserve Outstanding Field</label>
          <select
            id="matrix-reserve-outstanding-column"
            value={reserveOutstandingColumn}
            onChange={(e) => setReserveOutstandingColumn(e.target.value)}
            className="pivot-select"
          >
            <option value="">No reserve column (treat as 0)</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!adjusterColumn || !statusColumn ? (
        <p className="table-note">Select both fields to generate the matrix report.</p>
      ) : (
        <div className="table-wrapper">
          <table className="pivot-table matrix-table">
            <thead>
              <tr>
                <th>{adjusterColumn}</th>
                <th className="matrix-col-open-without-pay">Claims Open Without Pay</th>
                <th className="matrix-col-closed-without-pay">Claims Closed Without Pay</th>
                <th className="matrix-col-open-with-pay">Claims Open With Pay</th>
                <th className="matrix-col-open-with-pay-paid">Open With Pay - Paid ITD</th>
                <th className="matrix-col-open-with-pay-reserve">Open With Pay - Direct Loss Reserve Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={row.adjuster}>
                  <td>{row.adjuster}</td>
                  <td className="number">{row.openWithoutPayCount}</td>
                  <td className="number">{row.closedWithoutPayCount}</td>
                  <td className="number">{row.openWithPayCount}</td>
                  <td className="number">{formatCurrency(row.openWithPayPaidItd)}</td>
                  <td className="number">{formatCurrency(row.openWithPayReserveOutstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="matrix-total-row">
                <td>Total</td>
                <td className="number">{matrixTotals.openWithoutPayCount}</td>
                <td className="number">{matrixTotals.closedWithoutPayCount}</td>
                <td className="number">{matrixTotals.openWithPayCount}</td>
                <td className="number">{formatCurrency(matrixTotals.openWithPayPaidItd)}</td>
                <td className="number">{formatCurrency(matrixTotals.openWithPayReserveOutstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
