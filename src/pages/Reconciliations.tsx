import { useEffect, useState } from 'react'
import { Check, ClipboardCheck, Plus, RefreshCw } from 'lucide-react'
import { Card, ErrorMessage, formatMoney, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { createReconciliation, listReconciliations, updateReconciliationItem } from '../services/reconciliation'
import { listPortfolios } from '../services/portfolio'
import { demoRoles, readDemoRole } from '../services/roles'

type Session = Record<string, unknown> & { items: Record<string, unknown>[] }

export default function ReconciliationsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [portfolios, setPortfolios] = useState<Record<string, unknown>[]>([])
  const [portfolioId, setPortfolioId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [nextSessions, nextPortfolios] = await Promise.all([listReconciliations(), listPortfolios()])
    setSessions(nextSessions as unknown as Session[]); setPortfolios(nextPortfolios as unknown as Record<string, unknown>[])
    if (!portfolioId && nextPortfolios[0]) setPortfolioId(nextPortfolios[0].id)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function create() {
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    try { await createReconciliation(portfolioId, { id: role.id, name: role.name }); setError(''); setMessage('Session simulée créée avec des écarts de démonstration clairement identifiés.'); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Échec du rapprochement.') }
  }

  async function resolve(item: Record<string, unknown>) {
    const role = demoRoles.find((record) => record.id === readDemoRole())!
    try { await updateReconciliationItem(String(item.id), { status: 'RESOLVED', comment: `Analyse et résolution saisies par ${role.name} — cas simulé.`, actor: { id: role.id, name: role.name } }); setError(''); setMessage('Anomalie résolue, avec responsable et horodatage enregistrés.'); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Résolution impossible.') }
  }

  if (loading) return <ModuleLoading />
  const totalAnomalies = sessions.reduce((sum, session) => sum + session.items.filter((item) => item.status !== 'RESOLVED').length, 0)
  return <div className="module-page"><PageHeader eyebrow="BACK-OFFICE · POSITIONS & ESPÈCES" title="Rapprochements" description="Comparez les positions et soldes internes à des relevés externes simulés." action={<><select className="filter-select heading-select" value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)}>{portfolios.map((portfolio) => <option key={String(portfolio.id)} value={String(portfolio.id)}>{String(portfolio.name)}</option>)}</select><button className="button button-primary" disabled={!portfolioId} onClick={() => void create()}><Plus size={15} /> Nouveau rapprochement</button></>} />
    <ErrorMessage>{error}</ErrorMessage>{message && <div className="success-note">{message}</div>}
    <div className="market-summary-grid"><Card className="summary-chip"><span>SESSIONS</span><strong>{sessions.length}</strong><small>rapprochements locaux</small></Card><Card className="summary-chip"><span>ÉCARTS OUVERTS</span><strong className={totalAnomalies ? 'risk-number-critical' : ''}>{totalAnomalies}</strong><small>à analyser par un responsable</small></Card><Card className="summary-chip"><span>RÉSOLUS</span><strong>{sessions.reduce((sum, session) => sum + session.items.filter((item) => item.status === 'RESOLVED').length, 0)}</strong><small>avec piste d’audit</small></Card><Card className="summary-chip"><span>SOURCE EXTERNE</span><strong className="strategy-value">Simulée</strong><small>aucune connexion dépositaire / banque</small></Card></div>
    {sessions.length ? <div className="reconciliation-sessions">{sessions.map((session) => { const openItems = session.items.filter((item) => item.status !== 'RESOLVED'); return <Card key={String(session.id)} className="reconciliation-card"><div className="reconciliation-session-head"><div className="session-title-icon"><ClipboardCheck size={18} /></div><div className="session-title"><strong>{String(session.portfolioName)}</strong><span>Session du {String(session.date)} · {Number(session.positionCount)} position(s) comparée(s)</span></div><StatusBadge tone={session.status === 'RESOLVED' ? 'green' : 'orange'}>{session.status === 'RESOLVED' ? 'Clôturée' : `${openItems.length} écart(s) à traiter`}</StatusBadge></div><div className="reconciliation-items">{session.items.map((item) => <div className={`reconciliation-item ${item.status === 'RESOLVED' ? 'item-resolved' : ''}`} key={String(item.id)}><div className="exception-mark">{item.status === 'RESOLVED' ? <Check size={14} /> : '!'}</div><div className="exception-copy"><strong>{String(item.instrumentName)}</strong><span>{item.type === 'CASH' ? 'Rapprochement espèces' : `Écart position · ${String(item.instrumentId)}`}</span><small>Interne : {item.type === 'CASH' ? formatMoney(Number(item.internalValue)) : Number(item.internalValue).toLocaleString('fr-FR')} · Externe simulé : {item.type === 'CASH' ? formatMoney(Number(item.externalValue)) : Number(item.externalValue).toLocaleString('fr-FR')} · Écart : {item.type === 'CASH' ? formatMoney(Number(item.difference)) : Number(item.difference).toLocaleString('fr-FR')}</small><em>{String(item.comment)}</em>{item.status === 'RESOLVED' && <small>Résolu par {String(item.resolvedBy)} · {new Date(String(item.resolvedAt)).toLocaleString('fr-FR')}</small>}</div><div className="exception-actions"><StatusBadge tone={item.status === 'RESOLVED' ? 'green' : 'orange'}>{item.status === 'RESOLVED' ? 'Résolu' : 'Ouvert'}</StatusBadge>{item.status !== 'RESOLVED' && <button className="button button-secondary mini-resolve" onClick={() => void resolve(item)}><Check size={13} /> Résoudre</button>}</div></div>)}</div><div className="session-footer"><span><RefreshCw size={13} /> Données externes de démonstration</span><span>Responsable session : {String(session.createdBy)}</span></div></Card> })}</div> : <Card><div className="empty-state-card"><ClipboardCheck size={24} /><strong>Aucun rapprochement enregistré</strong><span>Choisissez un portefeuille et ouvrez une session pour générer des écarts synthétiques à traiter.</span></div></Card>}
    <div className="disclaimer-line">Les écarts externes sont générés par la démonstration et ne proviennent ni d’une banque ni d’un dépositaire réel.</div>
  </div>
}
