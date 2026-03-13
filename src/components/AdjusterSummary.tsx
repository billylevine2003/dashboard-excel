import { useEffect, useMemo, useState } from 'react'

interface AdjusterSummaryProps {
  data: any[]
  peerData: any[]
  selectedAdjusters: string[]
}

type Bucket = 'open' | 'closed' | 'other'

const normalize = (value: string): string => value.trim().toLowerCase()

const findColumn = (columns: string[], candidates: string[]): string | null => {
  const normalizedCandidates = candidates.map((candidate) => normalize(candidate))

  for (const column of columns) {
    if (normalizedCandidates.includes(normalize(column))) {
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

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

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

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

const getAgeInDays = (value: unknown): number | null => {
  const reportDate = parseDateValue(value)
  if (!reportDate) {
    return null
  }

  const now = new Date()
  const reportUtc = Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate())
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = nowUtc - reportUtc

  if (diff < 0) {
    return 0
  }

  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const getStatusBucket = (value: unknown): Bucket => {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (/\bclosed\b/.test(normalized)) {
    return 'closed'
  }

  if (
    /\bopen\b/.test(normalized) ||
    /\breopen\b/.test(normalized) ||
    /\breopened\b/.test(normalized) ||
    /\bre-open\b/.test(normalized) ||
    /\bre-opened\b/.test(normalized)
  ) {
    return 'open'
  }

  return 'other'
}

const formatCount = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatPercent = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value)

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const formatDays = (value: number): string =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} days`

interface AdjusterMetrics {
  adjuster: string
  claims: number
  openClaims: number
  closedClaims: number
  openWithoutPay: number
  paidItd: number
  reserveOutstanding: number
  averageOpenAge: number | null
  closeRate: number
  openWithoutPayRate: number
  paidPerClaim: number
}

interface SummaryCard {
  metrics: AdjusterMetrics
  strengths: string[]
  focusAreas: string[]
}

interface AiSummaryResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const getAdjusterMetricsMap = (rows: any[], columns: string[]): Map<string, AdjusterMetrics> => {
  const adjusterColumn = findColumn(columns, ['adjuster', 'examiner code', 'component adjuster'])
  const claimNumberColumn = findColumn(columns, ['claim number'])
  const statusColumn = findColumn(columns, ['claim status', 'status'])
  const paidColumn = findColumn(columns, ['direct loss paid itd', 'direct loss paid'])
  const reserveColumn = findColumn(columns, ['direct loss reserve outstanding', 'reserve outstanding'])
  const claimAgeColumn = findColumn(columns, ['claim age (days)', 'claim age days'])
  const reportDateColumn = findColumn(columns, ['claim reported date', 'reported date', 'report date'])

  if (!adjusterColumn) {
    return new Map<string, AdjusterMetrics>()
  }

  const claimSeenByAdjuster = new Map<string, Set<string>>()
  const openSeenByAdjuster = new Map<string, Set<string>>()
  const closedSeenByAdjuster = new Map<string, Set<string>>()
  const openWithoutPaySeenByAdjuster = new Map<string, Set<string>>()
  const ageSeenByAdjuster = new Map<string, Set<string>>()

  const grouped = new Map<string, Omit<AdjusterMetrics, 'closeRate' | 'openWithoutPayRate' | 'paidPerClaim'>>()

  rows.forEach((row) => {
    const adjuster = String(row[adjusterColumn] ?? '').trim()
    if (!adjuster) {
      return
    }

    const paid = paidColumn ? parseNumber(row[paidColumn]) : 0
    const reserve = reserveColumn ? parseNumber(row[reserveColumn]) : 0
    const bucket = statusColumn ? getStatusBucket(row[statusColumn]) : 'other'
    const claimId = claimNumberColumn ? String(row[claimNumberColumn] ?? '').trim() : ''
    const hasClaimId = Boolean(claimId)

    const reportAge = reportDateColumn ? getAgeInDays(row[reportDateColumn]) : null
    const fallbackAge = claimAgeColumn ? parseNumber(row[claimAgeColumn]) : 0
    const effectiveAge = reportAge ?? (fallbackAge > 0 ? fallbackAge : null)

    if (!grouped.has(adjuster)) {
      grouped.set(adjuster, {
        adjuster,
        claims: 0,
        openClaims: 0,
        closedClaims: 0,
        openWithoutPay: 0,
        paidItd: 0,
        reserveOutstanding: 0,
        averageOpenAge: null,
      })
      claimSeenByAdjuster.set(adjuster, new Set<string>())
      openSeenByAdjuster.set(adjuster, new Set<string>())
      closedSeenByAdjuster.set(adjuster, new Set<string>())
      openWithoutPaySeenByAdjuster.set(adjuster, new Set<string>())
      ageSeenByAdjuster.set(adjuster, new Set<string>())
    }

    const current = grouped.get(adjuster)
    const claimSeen = claimSeenByAdjuster.get(adjuster)
    const openSeen = openSeenByAdjuster.get(adjuster)
    const closedSeen = closedSeenByAdjuster.get(adjuster)
    const openWithoutPaySeen = openWithoutPaySeenByAdjuster.get(adjuster)
    const ageSeen = ageSeenByAdjuster.get(adjuster)

    if (!current || !claimSeen || !openSeen || !closedSeen || !openWithoutPaySeen || !ageSeen) {
      return
    }

    current.paidItd += paid
    current.reserveOutstanding += reserve

    if (hasClaimId) {
      if (!claimSeen.has(claimId)) {
        claimSeen.add(claimId)
        current.claims += 1
      }
    } else {
      current.claims += 1
    }

    if (bucket === 'open') {
      if (hasClaimId) {
        if (!openSeen.has(claimId)) {
          openSeen.add(claimId)
          current.openClaims += 1
        }
      } else {
        current.openClaims += 1
      }

      const withoutPay = paid <= 0
      if (withoutPay) {
        if (hasClaimId) {
          if (!openWithoutPaySeen.has(claimId)) {
            openWithoutPaySeen.add(claimId)
            current.openWithoutPay += 1
          }
        } else {
          current.openWithoutPay += 1
        }
      }

      if (effectiveAge !== null) {
        if (hasClaimId) {
          if (!ageSeen.has(claimId)) {
            ageSeen.add(claimId)
            current.averageOpenAge = (current.averageOpenAge ?? 0) + effectiveAge
          }
        } else {
          current.averageOpenAge = (current.averageOpenAge ?? 0) + effectiveAge
        }
      }
    }

    if (bucket === 'closed') {
      if (hasClaimId) {
        if (!closedSeen.has(claimId)) {
          closedSeen.add(claimId)
          current.closedClaims += 1
        }
      } else {
        current.closedClaims += 1
      }
    }
  })

  const metricsMap = new Map<string, AdjusterMetrics>()

  grouped.forEach((item) => {
    const ageCount = ageSeenByAdjuster.get(item.adjuster)?.size ?? 0
    const averageOpenAge = ageCount > 0 && item.averageOpenAge !== null ? item.averageOpenAge / ageCount : null
    const closeRate = item.claims > 0 ? item.closedClaims / item.claims : 0
    const openWithoutPayRate = item.openClaims > 0 ? item.openWithoutPay / item.openClaims : 0
    const paidPerClaim = item.claims > 0 ? item.paidItd / item.claims : 0

    metricsMap.set(item.adjuster, {
      ...item,
      averageOpenAge,
      closeRate,
      openWithoutPayRate,
      paidPerClaim,
    })
  })

  return metricsMap
}

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const buildFallbackSummary = (card: SummaryCard, peerCount: number): string => {
  const { metrics, strengths, focusAreas } = card
  const closeRate = formatPercent(metrics.closeRate)
  const openWithoutPayRate = formatPercent(metrics.openWithoutPayRate)
  const avgOpenAge = metrics.averageOpenAge === null ? 'n/a' : formatDays(metrics.averageOpenAge)

  const topStrength = strengths[0] ?? 'Performance is stable against peers under current filters.'
  const topFocus = focusAreas[0] ?? 'No immediate focus areas are flagged under current filters.'

  return `${metrics.adjuster} currently manages ${formatCount(metrics.claims)} claims (${formatCount(metrics.openClaims)} open / ${formatCount(metrics.closedClaims)} closed), with a close rate of ${closeRate} and an open-without-pay rate of ${openWithoutPayRate}. Open claim age averages ${avgOpenAge}, while paid ITD totals ${formatCurrency(metrics.paidItd)} and reserve stands at ${formatCurrency(metrics.reserveOutstanding)}. Compared against ${formatCount(peerCount)} peer adjusters on the same non-adjuster filters, key strength: ${topStrength} Primary focus area: ${topFocus}`
}

const buildAiPrompt = (card: SummaryCard, peerCount: number): string => {
  const { metrics, strengths, focusAreas } = card

  return [
    'Create a concise insurance-claims adjuster performance summary in 3-4 sentences.',
    `Adjuster: ${metrics.adjuster}`,
    `Claims: ${metrics.claims}`,
    `Open Claims: ${metrics.openClaims}`,
    `Closed Claims: ${metrics.closedClaims}`,
    `Close Rate: ${formatPercent(metrics.closeRate)}`,
    `Open Without Pay: ${metrics.openWithoutPay}`,
    `Open Without Pay Rate: ${formatPercent(metrics.openWithoutPayRate)}`,
    `Average Open Age: ${metrics.averageOpenAge === null ? 'n/a' : formatDays(metrics.averageOpenAge)}`,
    `Paid ITD: ${formatCurrency(metrics.paidItd)}`,
    `Reserve Outstanding: ${formatCurrency(metrics.reserveOutstanding)}`,
    `Paid Per Claim: ${formatCurrency(metrics.paidPerClaim)}`,
    `Peer Count: ${peerCount}`,
    `Strength Signals: ${strengths.join(' | ')}`,
    `Focus Signals: ${focusAreas.join(' | ')}`,
    'Tone: factual, concise, action-oriented; do not include markdown or bullets.',
  ].join('\n')
}

const fetchAiSummary = async (card: SummaryCard, peerCount: number): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('missing-api-key')
  }

  const apiUrl = import.meta.env.VITE_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
  const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You summarize adjuster performance for an internal claims dashboard. Keep responses short and precise.',
        },
        {
          role: 'user',
          content: buildAiPrompt(card, peerCount),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`ai-request-failed-${response.status}`)
  }

  const payload = (await response.json()) as AiSummaryResponse
  const text = payload.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new Error('empty-ai-response')
  }

  return text
}

export default function AdjusterSummary({ data, peerData, selectedAdjusters }: AdjusterSummaryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const summary = useMemo(() => {
    if (!selectedAdjusters.length || !data.length) {
      return {
        cards: [],
        peerCount: 0,
      }
    }

    const selectedSet = new Set(selectedAdjusters.map((value) => value.trim()).filter(Boolean))
    const dataColumns = Object.keys(data[0] ?? {})
    const peerColumns = Object.keys(peerData[0] ?? data[0] ?? {})

    const selectedMetricsMap = getAdjusterMetricsMap(data, dataColumns)
    const peerMetricsMap = getAdjusterMetricsMap(peerData, peerColumns)

    const peerCandidates = Array.from(peerMetricsMap.values()).filter(
      (metrics) => !selectedSet.has(metrics.adjuster)
    )

    const peerCount = peerCandidates.length
    const peerBaseline = {
      closeRate: average(peerCandidates.map((peer) => peer.closeRate)),
      openWithoutPayRate: average(peerCandidates.map((peer) => peer.openWithoutPayRate)),
      averageOpenAge: average(
        peerCandidates
          .map((peer) => peer.averageOpenAge)
          .filter((value): value is number => value !== null)
      ),
      paidPerClaim: average(peerCandidates.map((peer) => peer.paidPerClaim)),
    }

    const cards: SummaryCard[] = selectedAdjusters
      .map((adjuster) => selectedMetricsMap.get(adjuster.trim()))
      .filter((value): value is AdjusterMetrics => Boolean(value))
      .map((metrics) => {
        const strengths: string[] = []
        const focusAreas: string[] = []

        if (peerCount === 0) {
          strengths.push('Summary metrics generated for this adjuster with current filters.')
          focusAreas.push('Add broader filters or remove adjuster-only filters to enable peer comparison.')

          return {
            metrics,
            strengths,
            focusAreas,
          }
        }

        const closeRateGap = metrics.closeRate - peerBaseline.closeRate
        if (closeRateGap >= 0.03) {
          strengths.push(`Closure rate is ${formatPercent(closeRateGap)} above peers.`)
        } else if (closeRateGap <= -0.03) {
          focusAreas.push(`Closure rate is ${formatPercent(Math.abs(closeRateGap))} below peers.`)
        }

        const withoutPayGap = metrics.openWithoutPayRate - peerBaseline.openWithoutPayRate
        if (withoutPayGap <= -0.02) {
          strengths.push(`Open-without-pay rate is ${formatPercent(Math.abs(withoutPayGap))} better than peers.`)
        } else if (withoutPayGap >= 0.02) {
          focusAreas.push(`Open-without-pay rate is ${formatPercent(withoutPayGap)} higher than peers.`)
        }

        if (metrics.averageOpenAge !== null && peerBaseline.averageOpenAge > 0) {
          const ageGap = metrics.averageOpenAge - peerBaseline.averageOpenAge
          if (ageGap <= -5) {
            strengths.push(`Open claim age is ${formatDays(Math.abs(ageGap))} faster than peers.`)
          } else if (ageGap >= 5) {
            focusAreas.push(`Open claim age trails peers by ${formatDays(ageGap)}.`)
          }
        }

        const paidGap = metrics.paidPerClaim - peerBaseline.paidPerClaim
        if (paidGap >= 2500) {
          strengths.push(`Average paid per claim is ${formatCurrency(paidGap)} above peers.`)
        } else if (paidGap <= -2500) {
          focusAreas.push(`Average paid per claim is ${formatCurrency(Math.abs(paidGap))} below peers.`)
        }

        if (strengths.length === 0) {
          strengths.push('Performance is in line with peer average on current filters.')
        }

        if (focusAreas.length === 0) {
          focusAreas.push('No material watch-outs against peers on current filters.')
        }

        return {
          metrics,
          strengths,
          focusAreas,
        }
      })

    return {
      cards,
      peerCount,
    }
  }, [data, peerData, selectedAdjusters])

  const primaryCard = summary.cards[0] ?? null
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiSummaryText, setAiSummaryText] = useState('')
  const [isFallbackSummary, setIsFallbackSummary] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    if (!primaryCard) {
      setAiSummaryText('')
      setIsAiLoading(false)
      setIsFallbackSummary(false)
      setAiStatusMessage('')
      return () => {
        isCancelled = true
      }
    }

    const fallbackSummary = buildFallbackSummary(primaryCard, summary.peerCount)

    const run = async () => {
      setIsAiLoading(true)
      setAiStatusMessage('')

      try {
        const liveSummary = await fetchAiSummary(primaryCard, summary.peerCount)

        if (isCancelled) {
          return
        }

        setAiSummaryText(liveSummary)
        setIsFallbackSummary(false)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setAiSummaryText(fallbackSummary)
        setIsFallbackSummary(true)

        const message = error instanceof Error ? error.message : ''
        if (message === 'missing-api-key') {
          setAiStatusMessage('Set VITE_OPENAI_API_KEY to enable live AI summaries.')
        } else {
          setAiStatusMessage('Live AI summary is unavailable right now; showing local summary.')
        }
      } finally {
        if (!isCancelled) {
          setIsAiLoading(false)
        }
      }
    }

    run()

    return () => {
      isCancelled = true
    }
  }, [primaryCard, summary.peerCount])

  return (
    <section className="adjuster-summary" aria-live="polite">
      <div className="adjuster-summary-header">
        <div className="kpi-header">
          <h2>Adjuster Summary</h2>
          <button
            type="button"
            className="kpi-toggle"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <p>
            Dynamic commentary and peer comparison on similar filtered claims.
          </p>

          {selectedAdjusters.length === 0 && (
            <p className="adjuster-summary-empty">
              Select an adjuster in the left panel to generate this summary.
            </p>
          )}

          {selectedAdjusters.length > 0 && summary.cards.length === 0 && (
            <p className="adjuster-summary-empty">
              No matching adjuster rows are available with the current filters.
            </p>
          )}

          {summary.cards.length > 0 && (
            <>
              <p className="adjuster-summary-peer-note">
                Comparison baseline: {formatCount(summary.peerCount)} peer adjusters with the same non-adjuster filters.
              </p>

              {primaryCard && (
                <div className="adjuster-ai-summary" aria-live="polite">
                  <h3>AI Summary: {primaryCard.metrics.adjuster}</h3>
                  <p className="adjuster-ai-summary-text">
                    {isAiLoading ? 'Generating AI summary…' : aiSummaryText}
                  </p>
                  {!isAiLoading && aiSummaryText && (
                    <p className="adjuster-ai-summary-meta">
                      Source: {isFallbackSummary ? 'local fallback summary' : 'live AI summary'}
                    </p>
                  )}
                  {aiStatusMessage && <p className="adjuster-ai-summary-status">{aiStatusMessage}</p>}
                  {selectedAdjusters.length > 1 && (
                    <p className="adjuster-ai-summary-status">
                      Multiple adjusters are selected. AI summary is shown for the first selected adjuster.
                    </p>
                  )}
                </div>
              )}

              <div className="adjuster-summary-grid">
                {summary.cards.map(({ metrics, strengths, focusAreas }) => (
                  <article key={metrics.adjuster} className="adjuster-summary-card">
                    <h3>{metrics.adjuster}</h3>

                    <div className="adjuster-summary-metrics">
                      <span>Claims: {formatCount(metrics.claims)}</span>
                      <span>Open: {formatCount(metrics.openClaims)}</span>
                      <span>Closed: {formatCount(metrics.closedClaims)}</span>
                      <span>Paid ITD: {formatCurrency(metrics.paidItd)}</span>
                      <span>Reserve: {formatCurrency(metrics.reserveOutstanding)}</span>
                    </div>

                    <div className="adjuster-commentary">
                      <h4>Positive Areas</h4>
                      <ul>
                        {strengths.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>

                      <h4>Focus Areas</h4>
                      <ul>
                        {focusAreas.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
