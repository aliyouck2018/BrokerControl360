import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Search, SlidersHorizontal, TrendingUp } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, formatMoney, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { db } from '../db/database'
import type { Instrument, MarketQuote } from '../types/database'
import { filterInstruments, importMarketBulletins, marketSummary } from '../services/market'
import { readDemoRole, demoRoles } from '../services/roles'

export default function MarketPage() {
  const [items, setItems] = useState<(Instrument & { latest?: MarketQuote })[]>([])
  const [summary, setSummary] = useState<{ instruments: number; quotes: number; index?: number; indexDate?: string; funds: number }>()
  const [search, setSearch] = useState('')
  const [assetClass, setAssetClass] = useState('')
  const [country, setCountry] = useState('')
  const [provenance, setProvenance] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Instrument>()
  const [history, setHistory] = useState<MarketQuote[]>([])
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const [result, stats] = await Promise.all([filterInstruments({ search, assetClass, country, offset: 0, limit: 10_000 }), marketSummary()])
    const quotes = await db.marketQuotes.toArray()
    const latest = new Map<string, MarketQuote>()
    for (const quote of quotes) {
      if (provenance && quote.status !== provenance) continue
      if (!latest.has(quote.instrumentId) || quote.date > latest.get(quote.instrumentId)!.date) latest.set(quote.instrumentId, quote)
    }
    const filtered = result.items.map((item) => ({ ...item, latest: latest.get(item.id) }))
      .filter((item) => item.latest !== undefined)
    setTotal(filtered.length)
    setItems(filtered.slice(page * 12, (page + 1) * 12))
    setSummary(stats)
    setLoading(false)
  }

  useEffect(() => { void load() }, [search, assetClass, country, provenance, page])

  async function showInstrument(instrument: Instrument) {
    setSelected(instrument)
    setHistory((await db.marketQuotes.where('instrumentId').equals(instrument.id).toArray()).sort((a, b) => a.date.localeCompare(b.date)))
  }

  async function reimport() {
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    const result = await importMarketBulletins({ id: role.id, name: role.name })
    setNotice(`${result.bulletins} bulletins réimportés sans doublons · ${result.instruments} instruments · ${result.quotes} cotations.`)
    await load()
  }

  const counts = useMemo(() => ({ observed: summary?.quotes ?? 0, funds: summary?.funds ?? 0 }), [summary])

  return <div className="module-page">
    <PageHeader eyebrow="RÉFÉRENTIEL BVMAC · OBSERVATIONS OFFICIELLES" title="Marché" description="Instruments, cotations et provenance issus des bulletins de septembre 2026." action={<><button className="button button-secondary" onClick={() => { const csv = ['ISIN;Mnémonique;Instrument;Classe;Émetteur;Cours;Statut;Bulletin', ...items.map((item) => [item.isin, item.mnemonic, item.name, item.assetClass, item.issuer, item.latest?.price, item.latest?.status, item.latest?.sourceBulletin].join(';'))].join('\n'); downloadFile(csv, 'referentiel-marche.csv', 'text/csv') }}><Download size={15} /> Export CSV</button><button className="button button-primary" onClick={() => void reimport()}><RefreshCw size={15} /> Réimporter les bulletins</button></>} />
    {notice && <div className="success-note">{notice}</div>}
    <div className="market-summary-grid"><Card className="summary-chip"><span>INSTRUMENTS COTÉS</span><strong>{summary?.instruments ?? '—'}</strong><small>actions &amp; obligations</small></Card><Card className="summary-chip"><span>INDICE BVMAC-AS</span><strong>{summary?.index?.toLocaleString('fr-FR') ?? '—'} <small>pts</small></strong><small>au {summary?.indexDate ?? '—'}</small></Card><Card className="summary-chip"><span>HISTORIQUE OBSERVÉ</span><strong>19 <small>séances</small></strong><small>{counts.observed.toLocaleString('fr-FR')} cotations sourcées</small></Card><Card className="summary-chip"><span>FONDS OPCVM</span><strong>{counts.funds}</strong><small>valeurs liquidatives observées</small></Card></div>
    <Card className="market-browser"><div className="filter-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Rechercher un instrument" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Rechercher ISIN, mnémonique, émetteur…" /></label><label className="filter-field"><SlidersHorizontal size={14} /><select aria-label="Filtrer par classe" value={assetClass} onChange={(event) => { setAssetClass(event.target.value); setPage(0) }}><option value="">Toutes les classes</option><option value="EQUITY">Actions</option><option value="BOND">Obligations</option><option value="FUND">OPCVM</option></select></label><select className="filter-select" aria-label="Filtrer par pays" value={country} onChange={(event) => { setCountry(event.target.value); setPage(0) }}><option value="">Tous les pays</option>{['Cameroun', 'Gabon', 'Congo', 'Tchad', 'Guinée équatoriale', 'RCA'].map((value) => <option key={value}>{value}</option>)}</select><select className="filter-select provenance-select" aria-label="Filtrer par provenance" value={provenance} onChange={(event) => { setProvenance(event.target.value); setPage(0) }}><option value="">Toutes les provenances</option><option value="OBSERVED">Observé</option><option value="INTERPOLATED">Interpolé</option><option value="SIMULATED">Simulé</option></select></div>
      {loading ? <ModuleLoading /> : items.length === 0 ? <div className="empty-table">Aucun instrument ne correspond à ces filtres.</div> : <div className="table-scroll"><table className="module-table market-table"><thead><tr><th>INSTRUMENT</th><th>CLASSE</th><th>PAYS / ÉMETTEUR</th><th>ISIN</th><th>DERNIER COURS</th><th>DATE</th><th>PROVENANCE</th></tr></thead><tbody>{items.map((instrument) => <tr key={instrument.id} onClick={() => void showInstrument(instrument)} className="clickable-row"><td><strong>{instrument.mnemonic}</strong><small>{instrument.name}</small></td><td>{instrument.assetClass === 'BOND' ? 'Obligation' : 'Action'}</td><td>{instrument.country}<small>{instrument.issuer}</small></td><td className="mono-cell">{instrument.isin}</td><td className="amount-cell">{formatMoney(instrument.latest?.price ?? 0)}</td><td>{instrument.latest?.date ?? '—'}</td><td><Provenance status={instrument.latest?.status ?? 'OBSERVED'} /></td></tr>)}</tbody></table></div>}
      <div className="table-pagination"><span>Page {page + 1} · {total.toLocaleString('fr-FR')} instruments filtrés · {provenance || 'cours les plus récents'}</span><div><button disabled={!page} onClick={() => setPage(Math.max(0, page - 1))}>← Précédent</button><button disabled={(page + 1) * 12 >= total} onClick={() => setPage(page + 1)}>Suivant →</button></div></div>
    </Card>
    <div className="method-note"><TrendingUp size={16} /><span><strong>Traçabilité des cotations.</strong> Les volumes et prix proviennent des bulletins importés. Les séances non observées restent vides ici ; les historiques démonstratifs sont accessibles séparément et portent un badge de provenance distinct.</span></div>
    {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(undefined)}><section className="modal-card instrument-modal" role="dialog" aria-modal="true" aria-label={`Fiche ${selected.mnemonic}`} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">FICHE INSTRUMENT · {selected.isin}</div><h2>{selected.name}</h2><p>{selected.issuer} · {selected.country}</p></div><button className="icon-button" onClick={() => setSelected(undefined)} aria-label="Fermer">×</button></div><div className="instrument-detail-grid"><div><span>CLASSE D’ACTIF</span><strong>{selected.assetClass === 'BOND' ? 'Obligation' : 'Action'}</strong></div><div><span>MNÉMONIQUE</span><strong>{selected.mnemonic}</strong></div><div><span>COUPON / TAUX</span><strong>{selected.couponRate ? `${selected.couponRate}%` : '—'}</strong></div><div><span>ÉCHÉANCE INDICATIVE</span><strong>{String(selected.maturityDate ?? '—')}</strong></div></div><div className="chart-modal"><ResponsiveContainer width="100%" height={210}><LineChart data={history}><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} /><YAxis domain={['auto', 'auto']} width={60} /><Tooltip labelFormatter={(label) => String(label)} formatter={(value) => [formatMoney(Number(value)), 'Cours']} /><Line type="monotone" dataKey="price" stroke="#30836d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div><div className="provenance-detail"><Provenance status={String(history.at(-1)?.status ?? 'OBSERVED')} /> <span>Source : {String(history.at(-1)?.sourceBulletin ?? 'bulletin non précisé')} · {String(history.at(-1)?.method ?? 'Valeur importée directement')}</span></div></section></div>}
  </div>
}

function Provenance({ status }: { status: string }) {
  const tone = status === 'OBSERVED' ? 'green' : status === 'INTERPOLATED' ? 'blue' : 'orange'
  return <StatusBadge tone={tone}>{status === 'OBSERVED' ? 'Observé' : status === 'INTERPOLATED' ? 'Interpolé' : 'Simulé'}</StatusBadge>
}

function downloadFile(content: string, name: string, mime: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}
