import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileBarChart, Plus, Printer } from 'lucide-react'
import { Card, ErrorMessage, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { listPortfolios } from '../services/portfolio'
import { exportReportCsv, listReports, makeReport, reportHtml } from '../services/reports'
import { demoRoles, readDemoRole } from '../services/roles'

type ReportRecord = Record<string, unknown>
const reportTypes = [
  ['COMPOSITION', 'Composition de portefeuille'], ['PERFORMANCE', 'Performance indicative'], ['LIMITS', 'Contrôle des limites'],
  ['OPERATIONS', 'Suivi des opérations'], ['INTERNAL_CONTROL', 'Contrôle interne'], ['RECONCILIATION', 'Rapprochements & suspens'],
]

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [portfolios, setPortfolios] = useState<Record<string, unknown>[]>([])
  const [portfolioId, setPortfolioId] = useState('')
  const [type, setType] = useState('COMPOSITION')
  const [selected, setSelected] = useState<ReportRecord>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [reportList, portfolioList] = await Promise.all([listReports(), listPortfolios()])
    setReports(reportList as ReportRecord[]); setPortfolios(portfolioList as unknown as Record<string, unknown>[])
    if (!portfolioId && portfolioList[0]) setPortfolioId(portfolioList[0].id)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function generate() {
    const role = demoRoles.find((item) => item.id === readDemoRole())!
    try { const report = await makeReport(portfolioId, type, { id: role.id, name: role.name }); setSelected(report as unknown as ReportRecord); setError(''); setMessage('Rapport archivé dans le stockage local de ce navigateur.'); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Génération du rapport impossible.') }
  }

  function downloadHtml(report: ReportRecord) {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([reportHtml(report)], { type: 'text/html;charset=utf-8' }))
    link.download = `brokercontrol360-${String(report.type).toLowerCase()}-${String(report.snapshotDate)}.html`
    link.click(); URL.revokeObjectURL(link.href)
  }

  function downloadCsv(report: ReportRecord) {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\ufeff', exportReportCsv(report)], { type: 'text/csv;charset=utf-8' }))
    link.download = `brokercontrol360-positions-${String(report.snapshotDate)}.csv`
    link.click(); URL.revokeObjectURL(link.href)
  }

  function printReport(report: ReportRecord) {
    const blobUrl = URL.createObjectURL(new Blob([reportHtml(report)], { type: 'text/html' }))
    const reportWindow = window.open(blobUrl, '_blank')
    if (!reportWindow) { URL.revokeObjectURL(blobUrl); setError('Autorisez l’ouverture d’un nouvel onglet pour imprimer le rapport en PDF.'); return }
    setError('')
    let printed = false
    const printWhenLoaded = () => {
      if (printed || reportWindow.closed) return
      printed = true
      reportWindow.focus()
      reportWindow.print()
    }
    reportWindow.addEventListener('load', printWhenLoaded, { once: true })
    if (reportWindow.document.readyState === 'complete') window.setTimeout(printWhenLoaded, 0)
    const releaseUrlWhenClosed = window.setInterval(() => {
      if (reportWindow.closed) {
        URL.revokeObjectURL(blobUrl)
        window.clearInterval(releaseUrlWhenClosed)
      }
    }, 1000)
  }

  if (loading) return <ModuleLoading />
  return <div className="module-page"><PageHeader eyebrow="REPORTING · EXPORTS LOCAUX" title="Rapports" description="Générez des états versionnés de portefeuille et de contrôle, avec leurs sources." action={<><select className="filter-select heading-select" value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)}>{portfolios.map((portfolio) => <option key={String(portfolio.id)} value={String(portfolio.id)}>{String(portfolio.name)}</option>)}</select><select className="filter-select heading-select" value={type} onChange={(event) => setType(event.target.value)}>{reportTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-primary" disabled={!portfolioId} onClick={() => void generate()}><Plus size={15} /> Générer le rapport</button></>} />
    <ErrorMessage>{error}</ErrorMessage>{message && <div className="success-note">{message}</div>}
    <div className="report-warning"><FileBarChart size={16} /><span><strong>Modèles de démonstration.</strong> Inspirés des thèmes de reporting cités dans le cahier des charges ; non validés comme formulaires ou déclarations réglementaires COSUMAF.</span></div>
    {selected && <Card className="report-preview"><div className="report-preview-head"><div><div className="panel-kicker">APERÇU · VERSION {String(selected.version)}</div><h2>{getTypeLabel(String(selected.type))} — {String(selected.portfolioName)}</h2><p>Arrêté au {String(selected.snapshotDate)} · Généré par {String(selected.createdBy)}</p></div><div className="report-actions"><button className="button button-secondary" onClick={() => downloadCsv(selected)}><Download size={14} /> CSV</button><button className="button button-secondary" onClick={() => downloadHtml(selected)}><ExternalLink size={14} /> HTML</button><button className="button button-primary" onClick={() => printReport(selected)}><Printer size={14} /> Imprimer / PDF</button></div></div><div className="report-disclaimer">{String(selected.warning)}</div><div className="report-kpis"><div><span>ACTIF NET</span><strong>{Number((selected.payload as Record<string, unknown>).nav).toLocaleString('fr-FR')} FCFA</strong></div><div><span>POSITIONS</span><strong>{((selected.payload as Record<string, unknown>).positions as unknown[]).length}</strong></div><div><span>PERFORMANCE INDICATIVE</span><strong>{Number((selected.payload as Record<string, unknown>).simpleReturnPct).toFixed(2)}%</strong></div><div><span>IMPACT STRESS</span><strong>{Number((selected.payload as Record<string, unknown>).stressLoss).toLocaleString('fr-FR')} FCFA</strong></div></div><div className="muted-note">{String((selected.payload as Record<string, unknown>).performanceDisclaimer)}</div><div className="report-preview-positions"><strong>Composition du portefeuille</strong><div className="table-scroll"><table className="module-table"><thead><tr><th>INSTRUMENT</th><th>ISIN</th><th>QUANTITÉ</th><th>VALORISATION</th><th>DONNÉE</th></tr></thead><tbody>{((selected.payload as Record<string, unknown>).positions as Record<string, unknown>[]).map((position) => <tr key={String(position.isin)}><td>{String(position.mnemonic)} · {String(position.name)}</td><td>{String(position.isin)}</td><td>{Number(position.quantity).toLocaleString('fr-FR')}</td><td>{Number(position.marketValue).toLocaleString('fr-FR')} FCFA</td><td><StatusBadge tone="green">{String(position.status)}</StatusBadge></td></tr>)}</tbody></table></div></div></Card>}
    <Card className="report-history"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">ARCHIVES LOCALES · VERSIONS CONSERVÉES</div><h2>Historique des rapports</h2></div><span className="muted-note">{reports.length} version(s)</span></div>{reports.length ? <div className="table-scroll"><table className="module-table"><thead><tr><th>TYPE DE RAPPORT</th><th>PORTEFEUILLE</th><th>ARRÊTÉ</th><th>GÉNÉRÉ PAR</th><th>VERSION</th><th>STATUT</th><th>ACTIONS</th></tr></thead><tbody>{reports.map((report) => <tr key={String(report.id)}><td><strong>{getTypeLabel(String(report.type))}</strong></td><td>{String(report.portfolioName)}</td><td>{String(report.snapshotDate)}</td><td>{String(report.createdBy)}</td><td>v{String(report.version)}</td><td><StatusBadge tone="orange">Démonstration</StatusBadge></td><td><div className="table-actions"><button className="mini-action" title="Aperçu" onClick={() => setSelected(report)}><FileBarChart size={14} /></button><button className="mini-action" title="Télécharger CSV" onClick={() => downloadCsv(report)}><Download size={14} /></button><button className="mini-action" title="Imprimer en PDF" onClick={() => printReport(report)}><Printer size={14} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state-card"><FileBarChart size={24} /><strong>Aucun rapport archivé</strong><span>La version générée est conservée dans IndexedDB sur ce navigateur.</span></div>}</Card>
    <div className="disclaimer-line">Les données SIMULATED ne doivent pas alimenter un reporting réglementaire réel. Les exportations incluent une mise en garde et la provenance.</div>
  </div>
}

function getTypeLabel(value: string) { return reportTypes.find(([id]) => id === value)?.[1] ?? value }
