import { useEffect, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, Plus, WalletCards } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, ErrorMessage, formatMoney, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { createPortfolio, listPortfolios, portfolioValuation } from '../services/portfolio'
import { demoRoles, readDemoRole } from '../services/roles'

export default function PortfoliosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('id') ?? ''
  const [portfolios, setPortfolios] = useState<Record<string, unknown>[]>([])
  const [valuation, setValuation] = useState<Awaited<ReturnType<typeof portfolioValuation>>>()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [strategy, setStrategy] = useState('Obligataire prudent')
  const [cash, setCash] = useState('25000000')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const records = await listPortfolios()
    setPortfolios(records as unknown as Record<string, unknown>[])
    setValuation(activeId ? await portfolioValuation(activeId) : undefined)
    setLoading(false)
  }
  useEffect(() => { void load() }, [activeId])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const manager = demoRoles.find((item) => item.id === readDemoRole())!
    try {
      const portfolio = await createPortfolio({ name, strategy, manager: manager.name, openingCash: Number(cash) })
      setShowForm(false); setName(''); setError('')
      await load(); setSearchParams({ id: portfolio.id })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Création impossible.') }
  }

  if (loading) return <ModuleLoading />

  if (activeId && valuation) return <div className="module-page">
    <button className="back-link" onClick={() => setSearchParams({})}><ArrowLeft size={15} /> Tous les portefeuilles</button>
    <PageHeader eyebrow={`${valuation.portfolio.code} · ${valuation.portfolio.strategy}`} title={valuation.portfolio.name} description={`${String((valuation.portfolio as unknown as Record<string, unknown>).manager ?? 'Gestionnaire démo')} · Benchmark ${valuation.portfolio.benchmark} · Portefeuille de démonstration`} action={<><Link className="button button-secondary" to={`/ordres?portfolioId=${encodeURIComponent(activeId)}&side=BUY`}>Acheter</Link><StatusBadge tone="blue">XAF · Données locales</StatusBadge></>} />
    <div className="market-summary-grid"><Card className="summary-chip"><span>VALEUR NETTE D’ACTIF</span><strong>{formatMoney(valuation.nav)}</strong><small>Positions valorisées + espèces</small></Card><Card className="summary-chip"><span>VALEUR DES TITRES</span><strong>{formatMoney(valuation.securitiesValue)}</strong><small>{valuation.positions.length} lignes en portefeuille</small></Card><Card className="summary-chip"><span>ESPÈCES DISPONIBLES</span><strong>{formatMoney(valuation.cashBalance)}</strong><small>Compte local de démonstration</small></Card><Card className="summary-chip"><span>STRATÉGIE</span><strong className="strategy-value">{valuation.portfolio.strategy}</strong><small>{valuation.portfolio.currency} · {valuation.portfolio.benchmark}</small></Card></div>
    <Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">COMPOSITION À DATE</div><h2>Positions et valorisation</h2></div><span className="muted-note">Quantité et cours avec provenance distincte · coupon couru inclus pour les obligations</span></div>{valuation.positions.length ? <div className="table-scroll"><table className="module-table"><thead><tr><th>INSTRUMENT</th><th>QUANTITÉ</th><th>DERNIER COURS</th><th>COUPON COURU</th><th>VALORISATION</th><th>POIDS</th><th>PROVENANCE</th><th>ACTION</th></tr></thead><tbody>{valuation.positions.map((position) => <tr key={position.instrument.id}><td><strong>{position.instrument.mnemonic}</strong><small>{position.instrument.name} · {position.instrument.isin}</small></td><td>{position.quantity.toLocaleString('fr-FR')}<small>{position.quantitySource}</small></td><td>{formatMoney(position.price)}<small>{position.quoteDate}</small></td><td>{formatMoney(position.accruedInterest)}</td><td className="amount-cell">{formatMoney(position.marketValue)}</td><td>{(position.marketValue / (valuation.nav || 1) * 100).toFixed(1)}%</td><td><StatusBadge tone={position.quantitySource.includes('SIMULATED') ? 'orange' : 'blue'}>{position.quantitySource}</StatusBadge><small><StatusBadge tone={position.status === 'OBSERVED' ? 'green' : 'orange'}>{position.status}</StatusBadge></small></td><td><div className="portfolio-detail-actions"><Link className="mini-button button button-secondary" to={`/ordres?portfolioId=${encodeURIComponent(activeId)}&side=BUY&instrumentId=${encodeURIComponent(position.instrument.id)}`}>Acheter</Link><Link className="mini-button button button-secondary" to={`/ordres?portfolioId=${encodeURIComponent(activeId)}&side=SELL&instrumentId=${encodeURIComponent(position.instrument.id)}&quantity=${position.quantity}`}>Vendre</Link></div></td></tr>)}</tbody></table></div> : <div className="empty-table">Aucune transaction exécutée pour ce portefeuille.</div>}</Card>
    <Card className="transactions-card"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">PISTE DES OPÉRATIONS</div><h2>Transactions récentes</h2></div></div>{valuation.transactions.length ? <div className="table-scroll"><table className="module-table"><thead><tr><th>DATE</th><th>TYPE</th><th>INSTRUMENT</th><th>QUANTITÉ</th><th>MONTANT</th><th>ORIGINE</th></tr></thead><tbody>{valuation.transactions.slice(0, 12).map((transaction) => <tr key={String(transaction.id)}><td>{String(transaction.date)}</td><td>{String(transaction.type)}</td><td>{String(transaction.instrumentId ?? '—')}</td><td>{Number(transaction.quantity ?? 0).toLocaleString('fr-FR')}</td><td>{formatMoney(Number(transaction.amount ?? 0))}</td><td><StatusBadge tone="orange">SIMULATED</StatusBadge></td></tr>)}</tbody></table></div> : <p className="muted-note">Les transactions apparaîtront ici après leur exécution simulée.</p>}</Card>
  </div>

  return <div className="module-page"><PageHeader eyebrow="GESTION DES ACTIFS · XAF" title="Portefeuilles" description="Stratégies, positions et valorisation de vos mandats de démonstration." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nouveau portefeuille</button>} />
    <div className="portfolio-list">{portfolios.map((portfolio) => <PortfolioCard key={String(portfolio.id)} portfolio={portfolio} onClick={() => setSearchParams({ id: String(portfolio.id) })} />)}</div>
    {portfolios.length === 0 && <Card><div className="empty-table">Aucun portefeuille n’est enregistré sur ce navigateur.</div></Card>}
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><form className="modal-card form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">NOUVEAU MANDAT LOCAL</div><h2>Créer un portefeuille</h2><p>Enregistrement local — aucun compte réel.</p></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Fermer">×</button></div><ErrorMessage>{error}</ErrorMessage><label>Nom du portefeuille<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Fonds obligataire CEMAC" /></label><label>Stratégie<select value={strategy} onChange={(event) => setStrategy(event.target.value)}><option>Obligataire prudent</option><option>Diversifiée équilibrée</option><option>Actions CEMAC</option><option>Monétaire</option></select></label><label>Apport initial d’espèces (FCFA)<input required min="0" step="100000" type="number" value={cash} onChange={(event) => setCash(event.target.value)} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Annuler</button><button className="button button-primary" type="submit">Créer le portefeuille</button></div></form></div>}
  </div>
}

function PortfolioCard({ portfolio, onClick }: { portfolio: Record<string, unknown>; onClick: () => void }) {
  const [value, setValue] = useState<Awaited<ReturnType<typeof portfolioValuation>>>()
  useEffect(() => { void portfolioValuation(String(portfolio.id)).then(setValue) }, [portfolio.id])
  return <button className="portfolio-card" onClick={onClick}><div className="portfolio-card-top"><div className="portfolio-icon"><BriefcaseBusiness size={19} /></div><span className="portfolio-code">{String(portfolio.code)}</span><span className="portfolio-arrow">↗</span></div><div className="portfolio-card-name">{String(portfolio.name)}</div><div className="portfolio-strategy">{String(portfolio.strategy)}</div><div className="portfolio-card-value"><span>ACTIF NET</span><strong>{formatMoney(value?.nav ?? 0)}</strong></div><div className="portfolio-card-foot"><span><WalletCards size={13} /> {Number(value?.positions.length ?? 0)} lignes · {String(portfolio.currency)}</span><span>{String(portfolio.manager)}</span></div></button>
}
