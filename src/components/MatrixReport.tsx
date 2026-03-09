import { useEffect, useMemo, useState } from 'react'

interface MatrixReportProps {
  data: any[]
}

interface MatrixRow {
  adjuster: string
  openCount: number
  closedCount: number
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
  }, [columns, adjusterColumn, statusColumn, claimIdColumn])

  const matrixRows = useMemo<MatrixRow[]>(() => {
    if (!adjusterColumn || !statusColumn) {
      return []
    }

    const grouped = new Map<string, MatrixRow>()
    const seenByAdjusterOpen = new Map<string, Set<string>>()
    const seenByAdjusterClosed = new Map<string, Set<string>>()

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
          openCount: 0,
          closedCount: 0,
        })
        seenByAdjusterOpen.set(adjuster, new Set<string>())
        seenByAdjusterClosed.set(adjuster, new Set<string>())
      }

      const existing = grouped.get(adjuster)
      const openSeen = seenByAdjusterOpen.get(adjuster)
      const closedSeen = seenByAdjusterClosed.get(adjuster)
      if (!existing) {
        return
      }
      if (!openSeen || !closedSeen) {
        return
      }

      const statusBucket = getStatusBucket(status)
      if (statusBucket === 'open' && !openSeen.has(rowKey)) {
        openSeen.add(rowKey)
        existing.openCount += 1
      }
      if (statusBucket === 'closed' && !closedSeen.has(rowKey)) {
        closedSeen.add(rowKey)
        existing.closedCount += 1
      }
    })

    return Array.from(grouped.values()).sort((a, b) => a.adjuster.localeCompare(b.adjuster))
  }, [data, adjusterColumn, statusColumn, claimIdColumn])

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
      </div>

      {!adjusterColumn || !statusColumn ? (
        <p className="table-note">Select both fields to generate the matrix report.</p>
      ) : (
        <div className="table-wrapper">
          <table className="pivot-table matrix-table">
            <thead>
              <tr>
                <th>{adjusterColumn}</th>
                <th>Open</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={row.adjuster}>
                  <td>{row.adjuster}</td>
                  <td className="number">{row.openCount}</td>
                  <td className="number">{row.closedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
