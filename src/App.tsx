import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import {
  Activity, Bell, BookOpen, BriefcaseBusiness, ChartNoAxesCombined, ChevronDown,
  CircleHelp, ClipboardCheck, FileBarChart, History, LayoutDashboard, Menu, Search,
  Settings2, ShieldCheck, WalletCards, X,
} from 'lucide-react'
import { ModuleLoading } from './components/Common'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MarketPage = lazy(() => import('./pages/Market'))
const PortfoliosPage = lazy(() => import('./pages/Portfolios'))
const OrdersPage = lazy(() => import('./pages/Orders'))
const RisksPage = lazy(() => import('./pages/Risks'))
const ReconciliationsPage = lazy(() => import('./pages/Reconciliations'))
const ReportsPage = lazy(() => import('./pages/Reports'))
const WikiPage = lazy(() => import('./pages/Wiki'))
const AdministrationPage = lazy(() => import('./pages/Administration'))
const AuditPage = lazy(() => import('./pages/Audit'))
import { ensureDemoHistory, ensureMarketData } from './services/market'
import { seedDemoPortfolios } from './services/portfolio'
import { ensureWiki } from './services/wiki'
import { demoRoles, ensureDemoRoles, readDemoRole, selectDemoRole, type DemoRoleId } from './services/roles'

const navigation = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard, to: '/', allowed: ['risk_manager', 'operator', 'portfolio_manager', 'compliance', 'auditor', 'director', 'administrator'] as DemoRoleId[] },
  { label: 'Marché', icon: ChartNoAxesCombined, to: '/marche', allowed: ['risk_manager', 'operator', 'portfolio_manager', 'compliance', 'auditor', 'director', 'administrator'] as DemoRoleId[] },
  { label: 'Portefeuilles', icon: BriefcaseBusiness, to: '/portefeuilles', allowed: ['risk_manager', 'portfolio_manager', 'compliance', 'auditor', 'director', 'administrator'] as DemoRoleId[] },
  { label: 'Ordres', icon: Activity, to: '/ordres', allowed: ['risk_manager', 'operator', 'portfolio_manager', 'administrator'] as DemoRoleId[] },
  { label: 'Gestion des risques', icon: ShieldCheck, to: '/risques', allowed: ['risk_manager', 'compliance', 'auditor', 'director', 'administrator'] as DemoRoleId[] },
  { label: 'Rapprochements', icon: ClipboardCheck, to: '/rapprochements', allowed: ['risk_manager', 'operator', 'compliance', 'auditor', 'administrator'] as DemoRoleId[] },
  { label: 'Rapports', icon: FileBarChart, to: '/rapports', allowed: ['risk_manager', 'operator', 'portfolio_manager', 'compliance', 'auditor', 'director', 'administrator'] as DemoRoleId[] },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [roleId, setRoleId] = useState<DemoRoleId>(() => readDemoRole())
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState('')
  const role = demoRoles.find((item) => item.id === roleId) ?? demoRoles[0]
  const now = new Date()
  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(now).toLocaleUpperCase()
  const dateLabel = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(now).replace('.', '').toLocaleUpperCase()

  useEffect(() => {
    void (async () => {
      try {
        await ensureMarketData()
        await ensureDemoHistory()
        await seedDemoPortfolios()
        await ensureWiki()
        await ensureDemoRoles()
        setReady(true)
      } catch (error) {
        setStartupError(error instanceof Error ? error.message : 'Impossible d’initialiser les données locales.')
      }
    })()
  }, [])

  return (
    <div className="app-shell">
      {menuOpen && <button className="mobile-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><strong>BrokerControl<span>360</span></strong><small>MARKET INTELLIGENCE</small></div>
          <button className="icon-button sidebar-close" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">AF</div>
          <div className="workspace-copy"><strong>AFRILAND BOURSE</strong><span>Espace de démonstration</span></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-caption">ESPACE DE TRAVAIL</div>
        <nav className="main-nav" aria-label="Navigation principale">
          {navigation.filter(({ allowed }) => allowed.includes(roleId)).map(({ label, icon: Icon, to }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-caption nav-caption-bottom">RESSOURCES</div>
        <nav className="main-nav">
          <NavLink to="/wiki" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><BookOpen size={18} strokeWidth={1.8} /><span>Wiki &amp; méthodologie</span></NavLink>
          <NavLink to="/administration" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings2 size={18} strokeWidth={1.8} /><span>Administration</span></NavLink>
          <NavLink to="/audit" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><History size={18} strokeWidth={1.8} /><span>Journal d’audit</span></NavLink>
        </nav>

        <div className="sidebar-spacer" />
        <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Besoin d’aide ?</strong><span>Consulter le guide de prise en main</span></div></div>
        <div className="profile-card"><div className="profile-avatar">{role.initials}</div><label className="profile-copy profile-selector"><strong>{role.name}</strong><select aria-label="Choisir un profil fictif" value={role.id} onChange={async (event) => { const next = event.target.value as DemoRoleId; setRoleId(next); await selectDemoRole(next) }}><option value={role.id}>{role.label} · profil actif</option>{demoRoles.filter((item) => item.id !== role.id).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.name}</option>)}</select></label><ChevronDown size={15} className="profile-caret" /></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>BrokerControl360</span><span className="crumb-separator">/</span><strong>Vue d’ensemble</strong></div>
          <div className="topbar-actions">
            <span className="market-status"><i /> Marché fermé</span>
            <button className="icon-button top-search" aria-label="Rechercher"><Search size={19} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button>
            <div className="topbar-divider" />
            <div className="top-date"><span>{dayLabel}</span><strong>{dateLabel}</strong></div>
          </div>
        </header>
        <div className="demo-banner"><span className="demo-dot" /><span><strong>MODE DÉMONSTRATION</strong><em>Données synthétiques · environnement local uniquement</em></span><WalletCards size={17} /></div>
        <main className="page-content">
          {!ready ? <div className="startup-state"><span className="spinner" />{startupError ? <><strong>Initialisation interrompue</strong><p>{startupError}</p><button className="button button-secondary" onClick={() => window.location.reload()}>Réessayer</button></> : <><strong>Préparation de votre espace local…</strong><span>Import des bulletins BVMAC et création de la base de démonstration.</span></>}</div> : <Suspense fallback={<ModuleLoading />}><Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/marche" element={<MarketPage />} />
            <Route path="/portefeuilles" element={<PortfoliosPage />} />
            <Route path="/ordres" element={<OrdersPage />} />
            <Route path="/risques" element={<RisksPage />} />
            <Route path="/rapprochements" element={<ReconciliationsPage />} />
            <Route path="/rapports" element={<ReportsPage />} />
            <Route path="/wiki" element={<WikiPage />} />
            <Route path="/administration" element={<AdministrationPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<section className="empty-module"><div className="empty-module-icon"><BriefcaseBusiness size={22} /></div><span>ESPACE MÉTIER</span><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucun écran BrokerControl360.</p><NavLink to="/" className="button button-primary">Retour au tableau de bord</NavLink></section>} />
          </Routes></Suspense>}
        </main>
      </div>
    </div>
  )
}
