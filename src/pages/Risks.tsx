import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Plus, ShieldAlert } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, ErrorMessage, formatMoney, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { createDemoLimit, portfolioRisk } from '../services/risk'
import { listPortfolios } from '../services/portfolio'
import { demoRoles, readDemoRole } from '../services/roles'

export default function RisksPage() {
  const [portfolios, setPortfolios] = useState<Record<string, unknown>[]>([])
  const [portfolioId, setPortfolioId] = useState('')
  const [risk, setRisk] = useState<Awaited<ReturnType<typeof portfolioRisk>>>()
  const [loading, setLoading] = useState(true)
  const [showRule, setShowRule] = useState(false)
  const [ruleName, setRuleName] = useState('')
  const [limit, setLimit] = useState('30')
  const [error, setError] = useState('')

  async function load(id = portfolioId) {
    const portfolioData = await listPortfolios()
    setPortfolios(portfolioData as unknown as Record<string, unknown>[])
    const nextId = id || portfolioData[0]?.id || ''
    if (!portfolioId && nextId) setPortfolioId(String(nextId))
    setRisk(nextId ? await portfolioRisk(String(nextId)) : undefined)
    setLoading(false)
  }
  useEffect(() => { void load() }, [portfolioId])

  async function addRule(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    try { await createDemoLimit({ id: role.id, name: role.name }, { name: ruleName, scope: 'instrument', percentage: Number(limit) }); setShowRule(false); setRuleName(''); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette limite.') }
  }

  if (loading) return <ModuleLoading />
  return <div className="module-page"><PageHeader eyebrow="LIMITES · EXPOSITION · STRESS TEST" title="Gestion des risques" description="Mesurez les concentrations, les dépassements et l’impact des scénarios illustratifs." action={<><select className="filter-select heading-select" value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)}>{portfolios.map((portfolio) => <option key={String(portfolio.id)} value={String(portfolio.id)}>{String(portfolio.name)}</option>)}</select><button className="button button-primary" onClick={() => setShowRule(true)}><Plus size={15} /> Nouvelle limite</button></>} />
    <ErrorMessage>{error}</ErrorMessage>
    {!risk ? <Card><div className="empty-table">Créez un portefeuille afin de consulter les risques.</div></Card> : <>
      <div className="market-summary-grid risk-summary-grid"><Card className="summary-chip"><span>ACTIF NET ANALYSÉ</span><strong>{formatMoney(risk.valuation.nav)}</strong><small>{risk.valuation.portfolio.name}</small></Card><Card className="summary-chip"><span>CONCENTRATION HHI</span><strong>{risk.hhi.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</strong><small>{risk.diversificationLabel} · indicateur pédagogique</small></Card><Card className="summary-chip"><span>ALERTES DE LIMITES</span><strong className={risk.limits.some((item) => item.status === 'BREACH') ? 'risk-number-critical' : ''}>{risk.limits.filter((item) => item.status !== 'OK').length}</strong><small>seuils de démonstration à vérifier</small></Card><Card className="summary-chip stress-chip"><span>PERTE ESTIMÉE · STRESS</span><strong>{formatMoney(Math.abs(risk.estimatedStress))}</strong><small>NAV stressée {formatMoney(risk.stressedNav)}</small></Card></div>
      <div className="risk-grid"><Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">EXPOSITION PAR ÉMETTEUR</div><h2>Principales concentrations</h2></div><Activity size={16} className="subtle-icon" /></div>{risk.exposures.length ? risk.exposures.map((item) => <div className="exposure-row" key={item.label}><div className="exposure-label"><strong>{item.label}</strong><span>{formatMoney(item.value)} <b>{item.percentage.toFixed(1)}%</b></span></div><div className="exposure-track"><i style={{ width: `${Math.min(item.percentage, 100)}%` }} /></div></div>) : <div className="empty-table">Aucune ligne exposée actuellement.</div>}<div className="risk-footnote">La trésorerie est exclue du calcul HHI ; les expositions sont regroupées par émetteur.</div></Card>
        <Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">SCÉNARIO DE DÉMONSTRATION</div><h2>Stress marché</h2></div><div className="stress-icon"><AlertTriangle size={16} /></div></div><div className="stress-assumptions"><div><span>Actions</span><strong>−15%</strong></div><div><span>Obligations</span><strong>−4% × durée</strong></div><div><span>Liquidités</span><strong>−2%</strong></div></div><div className="stress-total"><span>Impact indicatif</span><strong className="negative-value">− {formatMoney(Math.abs(risk.estimatedStress))}</strong></div><p className="muted-note">Sensibilités pédagogiques, sans modèle de taux ou calibration statistique. Ne constituent pas une VaR ni une prévision.</p></Card></div>
      <Card className="limits-panel"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">RÈGLES CONFIGURABLES</div><h2>Suivi des limites</h2></div><span className="demo-only-pill"><ShieldAlert size={13} /> Valeurs de démonstration · à vérifier</span></div><div className="table-scroll"><table className="module-table"><thead><tr><th>RÈGLE</th><th>PÉRIMÈTRE</th><th>EXPOSITION</th><th>SEUIL</th><th>ÉCART</th><th>ÉTAT</th><th>VALIDATION</th></tr></thead><tbody>{risk.limits.map((rule) => <tr key={String(rule.id)}><td><strong>{String(rule.name)}</strong><small>{String(rule.note ?? '')}</small></td><td>{String(rule.scope)}</td><td>{rule.exposure.toFixed(1)}%</td><td>{rule.threshold.toFixed(1)}%</td><td className={rule.gap > 0 ? 'negative-value' : ''}>{rule.gap > 0 ? '+' : ''}{rule.gap.toFixed(1)} pts</td><td><StatusBadge tone={rule.status === 'BREACH' ? 'red' : rule.status === 'WARNING' ? 'orange' : 'green'}>{rule.status === 'BREACH' ? 'Dépassement' : rule.status === 'WARNING' ? 'À surveiller' : 'Conforme'}</StatusBadge></td><td><StatusBadge tone="orange">À vérifier</StatusBadge></td></tr>)}</tbody></table></div></Card>
      <Card className="allocation-risk-card"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">ALLOCATION PAR CLASSE</div><h2>Répartition du portefeuille</h2></div></div><div className="risk-allocation-list">{risk.allocations.map((allocation) => <div key={allocation.assetClass}><span>{allocation.assetClass === 'BOND' ? 'Obligations' : allocation.assetClass === 'EQUITY' ? 'Actions' : allocation.assetClass}</span><div className="exposure-track"><i style={{ width: `${Math.min(allocation.percentage, 100)}%` }} /></div><strong>{allocation.percentage.toFixed(1)}%</strong><small>{formatMoney(allocation.value)}</small></div>)}</div><div className="stress-chart"><ResponsiveContainer width="100%" height={190}><AreaChart data={[{ label: 'Avant', value: risk.valuation.nav }, { label: 'Stress', value: risk.stressedNav }]}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)} M`} /><Tooltip formatter={(value) => [formatMoney(Number(value)), 'NAV']} /><Area type="monotone" dataKey="value" stroke="#398c76" fill="#398c7620" /></AreaChart></ResponsiveContainer></div></Card>
    </>}
    {showRule && <div className="modal-backdrop" onClick={() => setShowRule(false)}><form className="modal-card form-modal" onSubmit={addRule} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">CONTRÔLE CONFIGURABLE</div><h2>Créer une limite de démo</h2><p>Seuil interne illustratif — à confirmer par la conformité.</p></div><button type="button" className="icon-button" onClick={() => setShowRule(false)} aria-label="Fermer">×</button></div><ErrorMessage>{error}</ErrorMessage><label>Nom du contrôle<input required value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Ex. Concentration secteur bancaire" /></label><label>Limite maximale<input required type="number" min="1" max="100" value={limit} onChange={(event) => setLimit(event.target.value)} /></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setShowRule(false)}>Annuler</button><button className="button button-primary" type="submit">Enregistrer la limite</button></div></form></div>}
    <div className="disclaimer-line">Les seuils et scénarios sont paramétrables et non confirmés. Aucun seuil réglementaire COSUMAF n’est présumé par l’application.</div>
  </div>
}
