import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Play, Plus, ShieldCheck, X } from 'lucide-react'
import { Card, ErrorMessage, formatMoney, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { db } from '../db/database'
import { approveOrder, createOrder, executeOrder, listOrders, rejectOrder } from '../services/orders'
import { demoRoles, readDemoRole } from '../services/roles'
import { latestInstrumentPrice, listPortfolios } from '../services/portfolio'
import { useSearchParams } from 'react-router-dom'

type OrderRecord = Record<string, unknown>

export default function OrdersPage() {
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [portfolios, setPortfolios] = useState<Record<string, unknown>[]>([])
  const [instruments, setInstruments] = useState<Record<string, unknown>[]>([])
  const [checks, setChecks] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [portfolioId, setPortfolioId] = useState('')
  const [instrumentId, setInstrumentId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const [nextOrders, nextPortfolios, nextInstruments, nextChecks] = await Promise.all([listOrders(), listPortfolios(), db.instruments.toArray(), db.orderChecks.toArray()])
    setOrders(nextOrders as unknown as OrderRecord[]); setPortfolios(nextPortfolios as unknown as Record<string, unknown>[]); setInstruments(nextInstruments as unknown as Record<string, unknown>[]); setChecks(nextChecks as unknown as Record<string, unknown>[])
    const requestedPortfolioId = searchParams.get('portfolioId')
    const requestedInstrumentId = searchParams.get('instrumentId')
    const requestedQuantity = searchParams.get('quantity')
    if (requestedPortfolioId && nextPortfolios.some((item) => item.id === requestedPortfolioId)) {
      setPortfolioId(requestedPortfolioId)
      setShowForm(true)
    }
    else if (!portfolioId && nextPortfolios[0]) setPortfolioId(nextPortfolios[0].id)
    if (requestedInstrumentId && nextInstruments.some((item) => item.id === requestedInstrumentId)) {
      setInstrumentId(requestedInstrumentId)
      setLimitPrice(String(await latestInstrumentPrice(requestedInstrumentId)))
    } else if (!instrumentId && nextInstruments[0]) {
      setInstrumentId(nextInstruments[0].id)
      setLimitPrice(String(await latestInstrumentPrice(nextInstruments[0].id)))
    }
    if (requestedQuantity && Number.isInteger(Number(requestedQuantity)) && Number(requestedQuantity) > 0) setQuantity(requestedQuantity)
    const requestedSide = searchParams.get('side')
    if (requestedSide === 'BUY' || requestedSide === 'SELL') setSide(requestedSide)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    try {
      const result = await createOrder({ portfolioId, instrumentId, side, quantity: Number(quantity), limitPrice: Number(limitPrice), validity: 'DAY', actorId: role.id, actorName: role.name })
      setChecks(result.checks as unknown as Record<string, unknown>[])
      setMessage(result.order.status === 'BLOCKED' ? 'Ordre enregistré mais bloqué par un contrôle critique.' : 'Contrôles enregistrés. L’ordre attend la validation maker-checker.')
      setShowForm(false); setQuantity(''); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de créer cet ordre.') }
  }

  async function action(order: OrderRecord, next: 'approve' | 'reject' | 'execute') {
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    try {
      if (next === 'approve') await approveOrder(String(order.id), { id: role.id, name: role.name })
      if (next === 'reject') await rejectOrder(String(order.id), { id: role.id, name: role.name })
      if (next === 'execute') await executeOrder(String(order.id), { id: role.id, name: role.name })
      setError(''); setMessage(next === 'execute' ? 'Exécution simulée enregistrée et position mise à jour.' : `Ordre ${next === 'approve' ? 'approuvé' : 'rejeté'} par ${role.name}.`); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action impossible.') }
  }

  if (loading) return <ModuleLoading />
  const activeChecks = checks.slice(-4)
  return <div className="module-page"><PageHeader eyebrow="CARNET · CONTRÔLES PRÉ-TRADE" title="Ordres" description="Créez, contrôlez, approuvez et exécutez des ordres de démonstration." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Saisir un ordre</button>} />
    <ErrorMessage>{error}</ErrorMessage>{message && <div className="success-note">{message}</div>}
    <div className="market-summary-grid order-summary-grid"><Card className="summary-chip"><span>ORDRES TOTAL</span><strong>{orders.length}</strong><small>cycle de vie local</small></Card><Card className="summary-chip"><span>EN ATTENTE</span><strong>{orders.filter((item) => item.status === 'PENDING_APPROVAL').length}</strong><small>validation maker-checker requise</small></Card><Card className="summary-chip"><span>EXÉCUTÉS EN DÉMO</span><strong>{orders.filter((item) => item.status === 'EXECUTED').length}</strong><small>sans transmission marché</small></Card><Card className="summary-chip"><span>CONTRÔLES ENREGISTRÉS</span><strong>{checks.length}</strong><small>piste de vérification locale</small></Card></div>
    <Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">ORDRES INTERNES · SIMULATION LOCALE</div><h2>Cycle de vie des ordres</h2></div><span className="muted-note">Approbateur différent du créateur requis</span></div>{orders.length ? <div className="table-scroll"><table className="module-table"><thead><tr><th>ORDRE</th><th>PORTEFEUILLE</th><th>INSTRUMENT</th><th>SENS</th><th>QUANTITÉ</th><th>PRIX LIMITE</th><th>MONTANT + FRAIS</th><th>STATUT</th><th>ACTION</th></tr></thead><tbody>{orders.map((order) => { const instrument = instruments.find((item) => item.id === order.instrumentId); const portfolio = portfolios.find((item) => item.id === order.portfolioId); return <tr key={String(order.id)}><td><strong>#{String(order.id).slice(0, 8)}</strong><small>{new Date(String(order.createdAt)).toLocaleString('fr-FR')}</small></td><td>{String(portfolio?.code ?? '—')}</td><td><strong>{String(instrument?.mnemonic ?? order.instrumentId)}</strong><small>{String(instrument?.name ?? '')}</small></td><td><span className={`side-tag ${order.side === 'BUY' ? 'side-buy' : 'side-sell'}`}>{order.side === 'BUY' ? <><ArrowDownLeft size={12} /> Achat</> : <><ArrowUpRight size={12} /> Vente</>}</span></td><td>{Number(order.quantity).toLocaleString('fr-FR')}</td><td>{formatMoney(Number(order.limitPrice))}</td><td>{formatMoney(Number(order.netAmount))}</td><td><OrderStatus value={String(order.status)} /></td><td><div className="table-actions">{order.status === 'PENDING_APPROVAL' && <><button className="mini-action approve-action" onClick={() => void action(order, 'approve')} title="Approuver par le rôle courant"><Check size={14} /></button><button className="mini-action reject-action" onClick={() => void action(order, 'reject')} title="Rejeter"><X size={14} /></button></>}{order.status === 'APPROVED' && <button className="button mini-button button-primary" onClick={() => void action(order, 'execute')}><Play size={12} /> Exécuter</button>}{order.status === 'BLOCKED' && <span className="muted-note">Ordre bloqué</span>}</div></td></tr> })}</tbody></table></div> : <div className="empty-state-card"><ShieldCheck size={24} /><strong>Aucun ordre dans le carnet</strong><span>Saisissez un premier ordre fictif pour démarrer le contrôle pré-trade.</span></div>}</Card>
    <Card className="checks-card"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">RÈGLES APPLIQUÉES AU DERNIER ORDRE</div><h2>Résultats des contrôles</h2></div></div>{activeChecks.length ? <div className="check-list">{activeChecks.map((check) => <div className="check-row" key={String(check.id)}><div className={`check-icon check-${String(check.severity).toLowerCase()}`}>{check.severity === 'OK' ? <Check size={14} /> : <CircleAlert size={14} />}</div><div><strong>{String(check.label)}</strong><span>{String(check.message)}</span></div><StatusBadge tone={check.severity === 'OK' ? 'green' : check.severity === 'WARNING' ? 'orange' : 'red'}>{String(check.severity)}</StatusBadge></div>)}</div> : <p className="muted-note">Les contrôles de l’ordre apparaîtront ici.</p>}</Card>
    <div className="disclaimer-line">Les ordres, cours d’exécution et frais affichés sont simulés. Aucune connexion BVMAC n’est active.</div>
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><form className="modal-card form-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">NOUVEL ORDRE · PRÉ-TRADE</div><h2>Saisir un ordre fictif</h2><p>Les contrôles précèdent toute approbation et exécution.</p></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Fermer">×</button></div><ErrorMessage>{error}</ErrorMessage><div className="side-toggle"><button type="button" className={side === 'BUY' ? 'chosen' : ''} onClick={() => setSide('BUY')}><ArrowDownLeft size={15} /> Achat</button><button type="button" className={side === 'SELL' ? 'chosen sell-chosen' : ''} onClick={() => setSide('SELL')}><ArrowUpRight size={15} /> Vente</button></div><label>Portefeuille<select required value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)}>{portfolios.map((portfolio) => <option key={String(portfolio.id)} value={String(portfolio.id)}>{String(portfolio.code)} · {String(portfolio.name)}</option>)}</select></label><label>Instrument<select required value={instrumentId} onChange={async (event) => { setInstrumentId(event.target.value); setLimitPrice(String((await db.marketQuotes.where('instrumentId').equals(event.target.value).last())?.price ?? 0)) }}>{instruments.map((instrument) => <option key={String(instrument.id)} value={String(instrument.id)}>{String(instrument.mnemonic)} · {String(instrument.name)}</option>)}</select></label><div className="form-two-column"><label>Quantité<input type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Prix limite (FCFA)<input type="number" min="1" step="1" required value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} /></label></div><div className="order-estimate"><span>Montant brut estimé</span><strong>{formatMoney(Number(quantity || 0) * Number(limitPrice || 0))}</strong><small>Frais de démonstration estimés à 0,20% · validité séance</small></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Annuler</button><button type="submit" className="button button-primary"><ShieldCheck size={15} /> Contrôler et enregistrer</button></div></form></div>}
  </div>
}

function OrderStatus({ value }: { value: string }) {
  const dictionary: Record<string, { text: string; tone: 'green' | 'red' | 'orange' | 'blue' | 'neutral' }> = { PENDING_APPROVAL: { text: 'En attente', tone: 'orange' }, APPROVED: { text: 'Approuvé', tone: 'blue' }, EXECUTED: { text: 'Exécuté (démo)', tone: 'green' }, BLOCKED: { text: 'Bloqué', tone: 'red' }, REJECTED: { text: 'Rejeté', tone: 'neutral' } }
  const status = dictionary[value] ?? { text: value, tone: 'neutral' as const }
  return <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
}
