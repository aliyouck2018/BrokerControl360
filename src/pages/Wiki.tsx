import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Search } from 'lucide-react'
import { Card, ModuleLoading, PageHeader, StatusBadge } from '../components/Common'
import { searchWiki } from '../services/wiki'

type Article = Record<string, unknown>

export default function WikiPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Article>()
  const [loading, setLoading] = useState(true)
  useEffect(() => { void searchWiki(search).then((result) => { setArticles(result as Article[]); setLoading(false) }) }, [search])
  useEffect(() => { if (!selected && articles[0]) setSelected(articles[0]) }, [articles, selected])
  if (loading) return <ModuleLoading />
  return <div className="module-page"><PageHeader eyebrow="WIKI PUBLIC · MÉTHODOLOGIE" title="Wiki & méthodologie" description="Des repères simples et professionnels sur le marché, les opérations et les calculs." />
    <div className="wiki-search"><Search size={17} /><input aria-label="Rechercher un article" placeholder="Rechercher OPCVM, FCP, COSUMAF, duration…" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{articles.length} article(s)</span></div>
    <div className="wiki-layout"><Card className="wiki-index"><div className="panel-kicker">GUIDE & GLOSSAIRE</div>{articles.length ? articles.map((article) => <button key={String(article.id)} className={`wiki-index-item ${selected?.id === article.id ? 'selected' : ''}`} onClick={() => setSelected(article)}><span className="wiki-category-dot" /><span><strong>{String(article.title)}</strong><small>{String(article.category)}</small></span><span className="wiki-index-arrow">→</span></button>) : <p className="muted-note">Aucun article trouvé pour cette recherche.</p>}</Card>
      {selected ? <Card className="wiki-article"><div className="wiki-article-top"><div className="wiki-article-icon"><BookOpen size={19} /></div><div><div className="eyebrow">{String(selected.category).toLocaleUpperCase()} · GUIDE</div><h2>{String(selected.title)}</h2></div><span className="wiki-tags"><StatusBadge tone={selected.ruleClass === 'OFFICIAL' ? 'blue' : selected.ruleClass === 'DEMO' ? 'orange' : 'green'}>{String(selected.ruleClass)}</StatusBadge><StatusBadge tone={selected.verificationStatus === 'CONFIRMED' ? 'green' : 'orange'}>{String(selected.verificationStatus)}</StatusBadge></span></div><div className="wiki-simple"><CheckCircle2 size={16} /><p>{String(selected.simple)}</p></div><section className="wiki-section"><h3>Définition professionnelle</h3><p>{String(selected.definition)}</p></section><section className="wiki-example"><span>EXEMPLE</span><p>{String(selected.example)}</p></section><section className="wiki-section"><h3>Formule ou règle</h3><div className="formula-box">{String(selected.formula)}</div></section><section className="wiki-section"><h3>Interprétation</h3><p>{String(selected.interpretation)}</p></section><section className="wiki-limit"><h3>Limite à connaître</h3><p>{String(selected.limitation)}</p></section><footer className="wiki-source"><strong>Source</strong><span>{String(selected.source)}</span><span className="wiki-source-status">{String(selected.verificationStatus) === 'CONFIRMED' ? 'Définition de référence' : 'À vérifier avant usage opérationnel'}</span></footer></Card> : <Card className="empty-table">Sélectionnez un sujet pour lire sa définition.</Card>}</div>
    <div className="disclaimer-line">Le Wiki est une aide pédagogique. Les règles classées OFFICIAL / TO_VERIFY doivent être confirmées dans les textes applicables.</div>
  </div>
}
