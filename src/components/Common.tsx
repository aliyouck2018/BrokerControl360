import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading module-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-actions">{action}</div>}</div>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green' | 'red' | 'orange' | 'blue' | 'neutral' }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel module-card ${className}`}>{children}</section>
}

export function ModuleLoading() { return <div className="module-loading"><span className="spinner" />Chargement de vos données locales…</div> }

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="inline-error" role="alert">{children}</div>
}

export const formatMoney = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FCFA`
export const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
export const timestamp = () => new Date().toISOString()
