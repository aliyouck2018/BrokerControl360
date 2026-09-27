import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ArrowUpRight as ArrowRight, BellRing, BriefcaseBusiness, FileBarChart, RefreshCw, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { db } from '../db/database'
import { portfolioRisk } from '../services/risk'
import { listPortfolios, portfolioValuation } from '../services/portfolio'
import { demoRoles, readDemoRole } from '../services/roles'

interface DashboardState {
  nav: number
  securities: number
  cash: number
  index: number
  indexChange: number
  indexDate: string
  indexSeries: { date: string; value: number; status: string }[]
  orders: Record<string, unknown>[]
  criticalAlerts: number
  warnings: number
  positions: { instrument: Record<string, unknown>; quantity: number; value: number; status: string }[]
  allocations: { label: string; value: number; color: string }[]
  audits: Record<string, unknown>[]
  portfoliosCount: number
}

const emptyDashboard: DashboardState = { nav: 0, securities: 0, cash: 0, index: 0, indexChange: 0, indexDate: '', indexSeries: [], orders: [], criticalAlerts: 0, warnings: 0, positions: [], allocations: [], audits: [], portfoliosCount: 0 }

export default function Dashboard() {
  const [data, setData] = useState(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [startMonth, setStartMonth] = useState('2026-01')
  const role = demoRoles.find((item) => item.id === readDemoRole()) ?? demoRoles[0]
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    void (async () => {
      const portfolios = await listPortfolios()
      const valuations = (await Promise.all(portfolios.map((portfolio) => portfolioValuation(portfolio.id)))).filter((item): item is NonNullable<typeof item> => Boolean(item))
      const risks = await Promise.all(portfolios.map((portfolio) => portfolioRisk(portfolio.id)))
      const quotes = await db.marketIndex.orderBy('date').toArray()
      const observedQuotes = quotes.filter((quote) => quote.status === 'OBSERVED')
      const observedSeries = observedQuotes.map((quote) => ({ date: String(quote.date), value: Number(quote.value) }))
      const latest = observedSeries.at(-1)
      const first = observedSeries[0]
      const rawOrders = await db.orders.orderBy('createdAt').reverse().toArray()
      const events = await db.auditEvents.orderBy('createdAt').reverse().limit(4).toArray()
      const positionMap = new Map<string, DashboardState['positions'][number]>()
      const classMap = new Map<string, number>()
      let securities = 0
      let cash = 0
      for (const valuation of valuations) {
        securities += valuation.securitiesValue
        cash += valuation.cashBalance
        for (const position of valuation.positions) {
          const key = position.instrument.id
          const prior = positionMap.get(key)
          positionMap.set(key, { instrument: position.instrument as unknown as Record<string, unknown>, quantity: (prior?.quantity ?? 0) + position.quantity, value: (prior?.value ?? 0) + position.marketValue, status: position.status })
          classMap.set(position.instrument.assetClass, (classMap.get(position.instrument.assetClass) ?? 0) + position.marketValue)
        }
      }
      if (cash > 0) classMap.set('CASH', cash)
      const nav = securities + cash || 1
      const allocations = [...classMap.entries()].map(([key, value]) => ({ label: key === 'BOND' ? 'Obligations' : key === 'EQUITY' ? 'Actions' : key === 'FUND' ? 'OPCVM' : 'Liquidités', value, color: key === 'BOND' ? '#398c76' : key === 'EQUITY' ? '#477ea0' : key === 'FUND' ? '#9fc9b6' : '#e2e9e7' }))
      const riskRules = risks.flatMap((item) => item?.limits ?? [])
      setData({
        nav, securities, cash, index: Number(latest?.value ?? 0), indexChange: first && latest ? (latest.value / first.value - 1) * 100 : 0,
         indexDate: latest?.date ?? '', indexSeries: quotes.map((quote) => ({ date: String(quote.date), value: Number(quote.value), status: String(quote.status ?? 'OBSERVED') })), orders: rawOrders,
        criticalAlerts: riskRules.filter((item) => item.status === 'BREACH').length,
        warnings: riskRules.filter((item) => item.status === 'WARNING').length,
        positions: [...positionMap.values()].sort((a, b) => b.value - a.value).slice(0, 4), allocations,
        audits: events as unknown as Record<string, unknown>[], portfoliosCount: portfolios.length,
      })
      setLoading(false)
    })()
  }, [])

  if (loading) return <ModuleLoading />
  const pendingOrders = data.orders.filter((order) => order.status === 'PENDING_APPROVAL')
  const totalOrders = data.orders.filter((order) => !['EXECUTED', 'REJECTED', 'BLOCKED'].includes(String(order.status)))
  const pieTotal = data.allocations.reduce((sum, item) => sum + item.value, 0) || 1
  let pieStart = 0
  const pieGradient = data.allocations.map((item) => {
    const start = pieStart
    pieStart += item.value / pieTotal * 100
    return `${item.color} ${start}% ${pieStart}%`
  }).join(', ')
  const personLabel = role.name.split(' ')[0]
  const visibleIndex = data.indexSeries.filter((item) => item.date >= `${startMonth}-01` && item.date <= '2026-09-30')
  const chartSeries = visibleIndex.map((item) => ({
    date: item.date,
    observed: item.status === 'OBSERVED' ? item.value : undefined,
    simulated: item.status === 'SIMULATED' ? item.value : undefined,
    interpolated: item.status === 'INTERPOLATED' ? item.value : undefined,
  }))
  const visibleValues = visibleIndex.map((item) => item.value)
  const indexMin = Math.min(...visibleValues, data.index)
  const indexMax = Math.max(...visibleValues, data.index)
  const monthChoices = Array.from({ length: 9 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`)

  return <div className="dashboard-page">
    <PageHeader eyebrow={`${today.toLocaleUpperCase()} · BONJOUR, ${personLabel.toLocaleUpperCase()}`} title="Vue d’ensemble" description="Pilotez vos opérations et gardez une vision claire de vos portefeuilles." action={<><Link className="button button-secondary" to="/rapports"><FileBarChart size={15} /> Rapports</Link><Link className="button button-primary" to="/ordres"><ArrowRight size={15} /> Nouvelle opération</Link></>} />
    <div className="data-ribbon"><div className="ribbon-icon"><RefreshCw size={15} /></div><span><strong>Dernière séance observée</strong> · {data.indexDate || 'Aucune donnée'}</span><span className="ribbon-source"><i /> Source bulletin BVMAC · historique synthétique séparé</span><Link className="icon-button" to="/marche" aria-label="Voir le marché"><ArrowRight size={17} /></Link></div>

    <section className="metrics-grid" aria-label="Indicateurs clés">
      <Metric label="ACTIF NET SOUS GESTION" icon={<WalletCards size={17} />} value={formatCompact(data.nav)} detail={`${data.portfoliosCount} portefeuille(s) · XAF`} positive />
      <Metric label="INDICE BVMAC-AS" icon={<TrendingUp size={17} />} value={data.index.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} suffix="pts" detail={data.indexDate ? `${data.indexDate} · observé` : 'Aucune séance observée'} positive={data.indexChange >= 0} change={data.indexChange} />
      <Metric label="ORDRES EN COURS" icon={<BriefcaseBusiness size={17} />} value={String(totalOrders.length).padStart(2, '0')} suffix="ordres" detail={`${pendingOrders.length} en attente de validation`} />
      <Metric label="ALERTES DE RISQUE" icon={<ShieldCheck size={17} />} value={String(data.criticalAlerts + data.warnings).padStart(2, '0')} suffix="alertes" detail={`${data.criticalAlerts} dépassement(s) · ${data.warnings} à surveiller`} danger={data.criticalAlerts > 0} />
    </section>

    <section className="overview-grid">
      <article className="panel performance-panel"><div className="panel-header"><div><div className="panel-kicker">HISTORIQUE BVMAC · JANVIER–SEPTEMBRE 2026</div><h2>Indice BVMAC-AS</h2></div><label className="filter-field chart-period"><span>Période</span><select aria-label="Début de période historique" value={startMonth} onChange={(event) => setStartMonth(event.target.value)}>{monthChoices.map((month) => <option key={month} value={month}>{new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} – septembre</option>)}</select></label></div><div className="chart-legend"><span><i className="legend-blue" /> OBSERVED</span><span><i className="legend-orange" /> SIMULATED</span><span><i className="legend-muted" /> INTERPOLATED</span><strong className={`chart-return ${data.indexChange < 0 ? 'negative-value' : ''}`}>{data.indexChange >= 0 ? '+' : ''}{data.indexChange.toFixed(2)}% <small>entre observations</small></strong></div><div className="market-index-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartSeries}><CartesianGrid stroke="#edf1f1" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(8)} tick={{ fill: '#9aa7ac', fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis domain={[indexMin * 0.995, indexMax * 1.005]} width={48} tick={{ fill: '#9aa7ac', fontSize: 8 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(value) => String(value)} /><Line type="monotone" dataKey="observed" name="OBSERVED" stroke="#398c76" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} connectNulls /><Line type="monotone" dataKey="simulated" name="SIMULATED" stroke="#d69a3b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls /><Line type="monotone" dataKey="interpolated" name="INTERPOLATED" stroke="#7295b1" strokeWidth={1.8} strokeDasharray="4 3" dot={false} connectNulls /></LineChart></ResponsiveContainer></div><div className="chart-footnote"><i />{visibleIndex.length} valeurs sur la période · observations, simulations et interpolations sont différenciées<a href="/wiki">Comprendre les données ↗</a></div></article>

      <article className="panel allocation-panel"><div className="panel-header"><div><div className="panel-kicker">VALORISATION AGRÉGÉE</div><h2>Allocation des actifs</h2></div><Link className="icon-button" to="/portefeuilles" aria-label="Voir les portefeuilles"><ArrowRight size={17} /></Link></div><div className="allocation-chart-wrap"><div className="donut-chart" style={{ background: `conic-gradient(${pieGradient})` }}><div className="donut-center"><strong>{formatCompact(data.nav)}</strong><span>FCFA</span></div></div><div className="allocation-legend">{data.allocations.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{(item.value / pieTotal * 100).toFixed(0)}%</strong></div>)}</div></div><div className="allocation-footer"><span><i /> {new Set(data.positions.map((position) => position.instrument.isin)).size} positions agrégées</span><Link className="text-button" to="/portefeuilles">Voir les mandats →</Link></div></article>
    </section>

    <section className="bottom-grid">
      <article className="panel positions-panel"><div className="panel-header"><div><div className="panel-kicker">SUIVI DES INVESTISSEMENTS</div><h2>Principales positions</h2></div><Link className="text-button" to="/portefeuilles">Tout voir →</Link></div>{data.positions.length ? <div className="table-scroll"><table><thead><tr><th>INSTRUMENT</th><th>CLASSE</th><th>QUANTITÉ</th><th>VALORISATION</th><th>POIDS</th><th>DONNÉE</th></tr></thead><tbody>{data.positions.map((position) => { const assetClass = String(position.instrument.assetClass); return <tr key={String(position.instrument.id)}><td><span className={`instrument-avatar ${assetClass === 'BOND' ? 'bond-avatar' : 'equity-avatar'}`}>{assetClass === 'BOND' ? 'OB' : assetClass === 'FUND' ? 'OP' : 'AC'}</span><span className="instrument-name">{String(position.instrument.mnemonic)}<small>{String(position.instrument.isin)} · {String(position.instrument.issuer)}</small></span></td><td><span className={`asset-tag ${assetClass === 'BOND' ? 'bond-tag' : assetClass === 'FUND' ? 'fund-tag' : 'equity-tag'}`}>{assetClass === 'BOND' ? 'Obligation' : assetClass === 'FUND' ? 'OPCVM' : 'Action'}</span></td><td>{position.quantity.toLocaleString('fr-FR')}</td><td className="amount-cell">{Math.round(position.value).toLocaleString('fr-FR')} <small>FCFA</small></td><td><div className="weight-cell"><span>{(position.value / data.nav * 100).toFixed(1)}%</span><i><b style={{ width: `${Math.min(position.value / data.nav * 100, 100)}%` }} /></i></div></td><td><StatusBadge tone="green">{position.status}</StatusBadge></td></tr> })}</tbody></table></div> : <div className="empty-table">Ajoutez des opérations d’achat simulées pour voir les positions ici.</div>}</article>

      <article className="panel activity-panel"><div className="panel-header"><div><div className="panel-kicker">PISTE D’AUDIT</div><h2>Activité récente</h2></div><Link className="icon-button" to="/audit" aria-label="Voir le journal"><BellRing size={17} /></Link></div><div className="activity-list">{data.audits.length ? data.audits.map((event, index) => <div className="activity-item" key={String(event.id)}><div className={`activity-marker marker-${index === 0 ? 'blue' : index === 1 ? 'green' : 'orange'}`}>{index === 0 ? '↗' : index === 1 ? '✓' : '·'}</div><div className="activity-copy"><strong>{String(event.description)}</strong><span>{String(event.entityType)}{event.entityId ? ` · ${String(event.entityId).slice(0, 12)}` : ''}</span><small>{new Date(String(event.createdAt)).toLocaleString('fr-FR')} <i /> {String(event.actorName)}</small></div></div>) : <div className="empty-table">Aucune activité enregistrée.</div>}</div><Link className="activity-footer" to="/audit">Consulter le journal d’audit <span>→</span></Link></article>
    </section>
    <footer className="page-footer"><span>BrokerControl360 <b>v0.1.0</b></span><span>Actif net et positions calculés sur les données locales · Série BVMAC observée distincte des données simulées</span></footer>
  </div>
}

function Metric({ label, icon, value, suffix, detail, positive, change, danger }: { label: string; icon: ReactNode; value: string; suffix?: string; detail: string; positive?: boolean; change?: number; danger?: boolean }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${danger ? 'alert-icon' : 'pale-icon'}`}>{icon}</span></div><div className="metric-value">{value} {suffix && <small>{suffix}</small>}</div><div className="metric-bottom">{change !== undefined ? <span className={`trend ${positive ? 'trend-up' : 'trend-down'}`}>{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change).toFixed(2)}%</span> : <span className="metric-context"><b className={`status-dot ${danger ? 'status-red' : 'status-orange'}`} />{detail}</span>}{change !== undefined && <span>{detail}</span>}</div></article>
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mds`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  return Math.round(value).toLocaleString('fr-FR')
}
