import { useEffect, useState } from 'react'
import { getStats, type SiteStats } from '../../api'
import { formats } from '../../constants'
import { useI18n } from '../../i18n/context'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import type { AppConfig } from '../../types'

interface LandingPageProps {
  config: AppConfig | null
  canCreate: boolean
  error: string
  onStart: () => void
}

export function LandingPage({ config, canCreate, error, onStart }: LandingPageProps) {
  const { locale, t } = useI18n()
  const [stats, setStats] = useState<SiteStats | null>(null)
  const channels = [...new Set(formats.map((format) => format.channel))]
  const number = new Intl.NumberFormat(locale)

  useEffect(() => {
    let active = true
    getStats()
      .then((value) => {
        if (active) setStats(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="landing">
      <div className="landing-top">
        <aside className="home-notice" role="note">
          <p className="eyebrow text-blue">{t.landing.noticeEyebrow}</p>
          <p>{t.landing.notice}</p>
        </aside>
        {stats && (
          <section className="home-stats" aria-label={t.landing.statsLabel}>
            <p>
              <strong>{number.format(stats.images)}</strong>
              <span>{t.landing.imagesCreated}</span>
            </p>
            <p>
              <strong>{number.format(stats.visitors)}</strong>
              <span>{t.landing.uniqueVisitors}</span>
            </p>
          </section>
        )}
        <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow text-pink">{t.landing.eyebrow}</p>
          <h1 className="display-title">{t.landing.title}</h1>
          <p className="page-lede">{t.landing.lede}</p>
          <div className="hero-actions">
            <Button onClick={onStart} disabled={!canCreate}>
              {t.landing.start} <span aria-hidden="true">↗</span>
            </Button>
            <p>{t.landing.note}</p>
          </div>
          {error && <Alert role="alert">{error}</Alert>}
          {config && !canCreate && !error && <Alert>{t.landing.unavailable}</Alert>}
        </div>
        <div className="mosaic" aria-hidden="true">
          <article className="mosaic-card mosaic-feature">
            <p className="eyebrow text-green">{t.landing.mosaic.spotlight}</p>
            <h2>{t.landing.mosaic.spotlightTitle}</h2>
            <span className="mosaic-bar bg-green" />
          </article>
          <article className="mosaic-card">
            <p className="eyebrow text-blue">{t.landing.mosaic.channels}</p>
            <h2>{t.landing.mosaic.channelsTitle}</h2>
          </article>
          <article className="mosaic-card mosaic-accent">
            <p className="eyebrow">{t.landing.mosaic.look}</p>
            <h2>{t.landing.mosaic.lookTitle}</h2>
          </article>
        </div>
        </section>
      </div>

      <section className="landing-section" aria-labelledby="channels-title">
        <div className="section-heading">
          <p className="eyebrow text-blue">{t.landing.channelsEyebrow}</p>
          <h2 id="channels-title">{t.landing.channelsTitle}</h2>
        </div>
        <ul className="channel-list">
          {channels.map((channel) => (
            <li key={channel}>
              <strong>{channel}</strong>
              <span>{formats.filter((format) => format.channel === channel).map((format) => t.formats[format.value]).join(' · ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="journey-title">
        <div className="section-heading">
          <p className="eyebrow text-orange">{t.landing.journeyEyebrow}</p>
          <h2 id="journey-title">{t.landing.journeyTitle}</h2>
        </div>
        <ol className="journey-list">
          {t.landing.journey.map((item, index) => (
            <li key={item.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
