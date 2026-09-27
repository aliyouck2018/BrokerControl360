import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Database, Download, RefreshCw, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import { Card, ErrorMessage, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { db } from '../db/database'
import { exportBackup, importBackup, resetDemoData } from '../services/backup'
import { importMarketBulletins } from '../services/market'
import { demoRoles, readDemoRole } from '../services/roles'
import { statelessApiAvailable } from '../services/api'

export default function AdministrationPage() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [apiAvailable, setApiAvailable] = useState(false)
  const [roles, setRoles] = useState(demoRoles)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function load() {
    const [instruments, quotes, portfolios, orders, anomalies, audits] = await Promise.all([db.instruments.count(), db.marketQuotes.count(), db.portfolios.count(), db.orders.count(), db.reconciliationItems.count(), db.auditEvents.count()])
    setStats({ instruments, quotes, portfolios, orders, anomalies, audits }); setRoles(demoRoles); setLoading(false)
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { void statelessApiAvailable(true).then(setApiAvailable) }, [])
  const actor = demoRoles.find((item) => item.id === readDemoRole())!

  async function downloadBackup() {
    setBusy('backup'); setError('')
    try { const data = await exportBackup(); download(data, `brokercontrol360-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); setMessage('Sauvegarde JSON téléchargée. Elle contient uniquement la base locale du navigateur.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Export impossible.') } finally { setBusy(''); await load() }
  }

  async function uploadBackup(file?: File) {
    if (!file) return
    setBusy('restore'); setError(''); setMessage('')
    try { await importBackup(await file.text()); setMessage('Sauvegarde validée puis restaurée dans cette base IndexedDB.'); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Restauration impossible.') } finally { setBusy(''); if (fileInput.current) fileInput.current.value = '' }
  }

  async function reimport() {
    setBusy('market'); setError(''); setMessage('')
    try { const result = await importMarketBulletins({ id: actor.id, name: actor.name }); setMessage(`Import idempotent : ${result.bulletins} bulletins, ${result.instruments} instruments et ${result.quotes.toLocaleString('fr-FR')} cotations.`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Import marché impossible.') } finally { setBusy('') }
  }

  async function reset() {
    if (!window.confirm('Réinitialiser toutes les données locales de démonstration ? Cette action efface les portefeuilles, ordres, rapports et journaux sauvegardés dans ce navigateur. Les fichiers JSON source du dossier json/ ne seront pas modifiés.')) return
    setBusy('reset'); setError(''); setMessage('')
    try { await resetDemoData(); localStorage.removeItem('brokercontrol360:demo-role'); window.location.reload() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Réinitialisation impossible.') } finally { setBusy('') }
  }

  if (loading) return <ModuleLoading />
  return <div className="module-page"><PageHeader eyebrow="PARAMÈTRES LOCAUX · PROFILS FICTIFS" title="Administration" description="Gérez les profils UX, la base navigateur et les imports de démonstration." />
    <ErrorMessage>{error}</ErrorMessage>{message && <div className="success-note">{message}</div>}
    <div className="admin-grid"><Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">STOCKAGE DU NAVIGATEUR</div><h2>IndexedDB · BrokerControl360</h2></div><div className="admin-card-icon"><Database size={17} /></div></div><p className="admin-description">Les données métier sont conservées sur cet appareil et cette origine. Aucune synchronisation serveur ou multi-appareil n’est activée.</p><div className="storage-stats">{Object.entries(stats).map(([label, value]) => <div key={label}><strong>{value.toLocaleString('fr-FR')}</strong><span>{({ instruments: 'Instruments', quotes: 'Cotations', portfolios: 'Portefeuilles', orders: 'Ordres', anomalies: 'Anomalies', audits: 'Événements audit' } as Record<string, string>)[label]}</span></div>)}</div><div className="api-status-row"><span>API stateless FastAPI</span><StatusBadge tone={apiAvailable ? 'green' : 'orange'}>{apiAvailable ? 'Connectée · calculs serveur' : 'Indisponible · calculs locaux'}</StatusBadge><button className="text-button" onClick={async () => setApiAvailable(await statelessApiAvailable(true))}>Vérifier</button></div><div className="admin-actions"><button className="button button-secondary" disabled={!!busy} onClick={() => void downloadBackup()}><Download size={14} /> {busy === 'backup' ? 'Préparation…' : 'Exporter sauvegarde JSON'}</button><button className="button button-secondary" disabled={!!busy} onClick={() => fileInput.current?.click()}><Upload size={14} /> {busy === 'restore' ? 'Restauration…' : 'Importer sauvegarde JSON'}</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void uploadBackup(event.target.files?.[0])} /></div></Card>
      <Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">DONNÉES DE MARCHÉ</div><h2>Source et mise à jour</h2></div><div className="admin-card-icon"><RefreshCw size={17} /></div></div><p className="admin-description">19 fichiers JSON du dossier <code>json/</code> sont lus et normalisés dans IndexedDB. L’import utilise des clés idempotentes par ISIN et date.</p><div className="import-status"><div><span>Bulletins disponibles</span><strong>19 séances · sept. 2026</strong></div><div><span>Instruments normalisés</span><strong>{stats.instruments} ISIN distincts</strong></div><div><span>Provenance source</span><strong><StatusBadge tone="green">OBSERVED</StatusBadge></strong></div></div><button className="button button-primary" disabled={!!busy} onClick={() => void reimport()}><RefreshCw size={14} /> {busy === 'market' ? 'Import en cours…' : 'Réimporter les bulletins'}</button></Card>
      <Card><div className="panel-header module-panel-heading"><div><div className="panel-kicker">UTILISATEURS ILLUSTRATIFS</div><h2>Profils de démonstration</h2></div><div className="admin-card-icon"><ShieldCheck size={17} /></div></div><p className="admin-description">Le rôle courant filtre l’expérience de navigation. Ce choix local ne constitue pas une authentification et ne protège pas les données.</p><div className="role-list">{roles.map((role) => <div key={role.id}><span className="role-avatar">{role.initials}</span><span className="role-name"><strong>{role.name}</strong><small>{role.label}</small></span>{role.id === actor.id ? <StatusBadge tone="green">Profil actif</StatusBadge> : <span className="role-demo-tag">Utilisateur fictif</span>}</div>)}</div></Card>
      <Card className="admin-danger-card"><div className="panel-header module-panel-heading"><div><div className="panel-kicker">OUTILS DE DÉMONSTRATION</div><h2>Réinitialisation locale</h2></div><div className="danger-icon"><AlertTriangle size={17} /></div></div><p className="admin-description">Efface les tables IndexedDB, puis réimporte les données marché et les jeux de démonstration au prochain démarrage.</p><div className="warning-box"><AlertTriangle size={14} /><span>Les sources JSON d’origine restent intactes. Exportez une sauvegarde si vous souhaitez conserver les portefeuilles ou rapports créés.</span></div><button className="button button-danger" disabled={!!busy} onClick={() => void reset()}><RotateCcw size={14} /> {busy === 'reset' ? 'Réinitialisation…' : 'Réinitialiser la démo'}</button></Card></div>
    <div className="disclaimer-line">Données exclusivement synthétiques · Aucun secret, compte bancaire ou renseignement client réel ne doit être saisi ici.</div>
  </div>
}

function download(data: string, fileName: string, type: string) {
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([data], { type })); link.download = fileName; link.click(); URL.revokeObjectURL(link.href)
}
