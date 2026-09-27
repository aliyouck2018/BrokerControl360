import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, History, Search } from 'lucide-react'
import { Card, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { db } from '../db/database'

const pageSize = 20

export default function AuditPage() {
  const [events, setEvents] = useState<Record<string, unknown>[]>([])
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionOptions, setActionOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const allEvents = await db.auditEvents.orderBy('createdAt').reverse().toArray()
      setActionOptions([...new Set(allEvents.map((event) => String(event.action)))].sort())
      let records = allEvents
      if (actionFilter) records = records.filter((event) => event.action === actionFilter)
      if (search.trim()) { const value = search.trim().toLocaleLowerCase(); records = records.filter((event) => `${event.actorName} ${event.description} ${event.entityType}`.toLocaleLowerCase().includes(value)) }
      setTotal(records.length); setEvents(records.slice(page * pageSize, (page + 1) * pageSize)); setLoading(false)
    })()
  }, [actionFilter, search, page])

  if (loading) return <ModuleLoading />
  const actions = actionOptions
  return <div className="module-page"><PageHeader eyebrow="JOURNAL PERSISTANT · INDEXEDDB" title="Journal d’audit" description="Historique local des opérations, imports, validations et modifications critiques." action={<StatusBadge tone="blue">{total} événement(s)</StatusBadge>} />
    <Card className="audit-panel"><div className="filter-toolbar"><label className="search-field"><Search size={16} /><input aria-label="Rechercher dans le journal" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Rechercher un acteur, une opération…" /></label><select className="filter-select" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(0) }} aria-label="Filtrer par type d’action"><option value="">Toutes les actions</option>{actions.map((action) => <option key={action}>{action}</option>)}</select></div>{events.length ? <div className="table-scroll"><table className="module-table audit-table"><thead><tr><th>DATE / HEURE</th><th>ACTEUR DE DÉMO</th><th>ACTION</th><th>OBJET</th><th>DESCRIPTION</th><th>RÉFÉRENCE</th></tr></thead><tbody>{events.map((event) => <tr key={String(event.id)}><td>{new Date(String(event.createdAt)).toLocaleString('fr-FR')}</td><td><strong>{String(event.actorName)}</strong><small>{String(event.actorId)}</small></td><td><StatusBadge tone={String(event.action).includes('REJECT') || String(event.action).includes('BLOCK') ? 'red' : String(event.action).includes('APPROVE') ? 'green' : 'blue'}>{String(event.action)}</StatusBadge></td><td>{String(event.entityType)}</td><td>{String(event.description)}</td><td className="mono-cell">{String(event.entityId ?? '—')}</td></tr>)}</tbody></table></div> : <div className="empty-state-card"><History size={23} /><strong>Aucun événement correspondant</strong><span>Les modifications importantes seront enregistrées dans ce navigateur.</span></div>}<div className="table-pagination"><span>Événements {total ? page * pageSize + 1 : 0}–{Math.min(total, (page + 1) * pageSize)} sur {total}</span><div><button disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /> Précédent</button><button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)}>Suivant <ChevronRight size={14} /></button></div></div></Card>
    <div className="disclaimer-line">Ce journal est stocké localement et n’est ni centralisé ni protégé contre l’utilisateur propriétaire du navigateur.</div>
  </div>
}
