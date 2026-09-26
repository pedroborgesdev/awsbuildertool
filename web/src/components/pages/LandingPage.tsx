import { useEffect, useState } from 'react'
import { getStats, type SiteStats } from '../../api'
import { formats } from '../../constants'
import { useI18n } from '../../i18n/context'
import { eyebrowClass, skeletonClass } from '../../styles'
import { CommunityCarousel } from '../community/CommunityCarousel'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import type { AppConfig } from '../../types'

const visitorCountEnabled = false

interface LandingPageProps {
  config: AppConfig | null
  configLoading: boolean
  canCreate: boolean
  error: string
  onStart: () => void
}

export function LandingPage({ config, configLoading, canCreate, error, onStart }: LandingPageProps) {
  const { locale, t } = useI18n()
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const channels = [...new Set(formats.map((format) => format.channel))]
  const number = new Intl.NumberFormat(locale)

  useEffect(() => {
    let active = true
    getStats()
      .then((value) => {
        if (active) setStats(value)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setStatsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const cardClass = 'border border-grid bg-panel/80 p-4'
  const mosaicCardClass = 'flex min-h-37 min-w-0 flex-col justify-between gap-4 overflow-hidden border border-grid bg-panel/90 p-[18px]'
  const statCardClass = 'grid min-w-40 gap-1 border border-grid bg-panel/90 px-4 py-3.5 max-[520px]:min-w-0 max-[520px]:flex-1 max-[520px]:gap-0.5 max-[520px]:px-3 max-[520px]:py-2.5'

  return (
    <main className="grid w-full gap-18 bg-ink px-5 pt-7 pb-20 min-[1200px]:mx-[72px] min-[1200px]:w-auto min-[1200px]:px-10 min-[1600px]:px-14">
      <div className="grid gap-7">
        <aside className="grid gap-2 border border-grid border-l-4 border-l-blue bg-panel/90 px-[18px] py-4" role="note">
          <p className={`${eyebrowClass} text-blue`}>{t.landing.noticeEyebrow}</p>
          <p className="max-w-[78ch] text-sm leading-relaxed text-[#d5dde4] max-[520px]:text-[11px] max-[520px]:leading-[1.45]">{t.landing.notice}</p>
        </aside>
        {(stats || statsLoading) && (
          <section className="flex flex-wrap gap-3 max-[520px]:flex-nowrap max-[520px]:gap-2" aria-label={t.landing.statsLabel}>
            {stats ? (
              <>
                <p className={statCardClass}>
                  <strong className="text-[28px] leading-none tracking-[-.03em] text-white max-[520px]:text-xl">{number.format(stats.images)}</strong>
                  <span className="text-xs font-bold tracking-[.06em] text-[#9aa7b2] uppercase max-[520px]:text-[10px] max-[520px]:leading-tight max-[520px]:tracking-[.04em]">{t.landing.imagesCreated}</span>
                </p>
                {visitorCountEnabled && (
                  <p className={statCardClass}>
                    <strong className="text-[28px] leading-none tracking-[-.03em] text-white max-[520px]:text-xl">{number.format(stats.visitors)}</strong>
                    <span className="text-xs font-bold tracking-[.06em] text-[#9aa7b2] uppercase max-[520px]:text-[10px] max-[520px]:leading-tight max-[520px]:tracking-[.04em]">{t.landing.uniqueVisitors}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                {Array.from({ length: visitorCountEnabled ? 2 : 1 }, (_, item) => (
                  <div className={statCardClass} aria-hidden="true" key={item}>
                    <span className={`${skeletonClass} block h-7 w-20`} />
                    <span className={`${skeletonClass} block h-3 w-28 max-w-full`} />
                  </div>
                ))}
              </>
            )}
          </section>
        )}
        <section className="grid items-stretch gap-7 min-[720px]:grid-cols-[minmax(0,1.05fr)_minmax(300px,.9fr)]">
          <div className="min-w-0">
            <p className={`${eyebrowClass} text-pink`}>{t.landing.eyebrow}</p>
            <h1 className="max-w-[12ch] [overflow-wrap:anywhere] text-[clamp(2.2rem,4.6vw,4.2rem)] leading-[.94] font-extrabold tracking-[-.06em]">{t.landing.title}</h1>
            <p className="mt-[18px] max-w-2xl text-base leading-[1.7] text-muted-light max-[520px]:text-[13px] max-[520px]:leading-[1.55]">{t.landing.lede}</p>
            <div className="mt-7 grid gap-3">
              {configLoading ? (
                <span className={`${skeletonClass} block min-h-12 w-full border border-grid`} aria-hidden="true" />
              ) : (
                <Button onClick={onStart} disabled={!canCreate}>
                  {t.landing.start} <span aria-hidden="true">↗</span>
                </Button>
              )}
              <p className="max-w-xl text-[13px] text-muted-light">{t.landing.note}</p>
            </div>
            {error && <Alert role="alert">{error}</Alert>}
            {config && !canCreate && !error && <Alert>{t.landing.unavailable}</Alert>}
          </div>
          <div className="grid min-w-0 gap-3 min-[720px]:grid-cols-[minmax(0,1.25fr)_minmax(150px,.9fr)] min-[720px]:grid-rows-[minmax(168px,auto)_minmax(148px,auto)]" aria-hidden="true">
            <article className={`${mosaicCardClass} [background-image:linear-gradient(to_right,rgba(0,229,130,.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,229,130,.16)_1px,transparent_1px)] [background-size:28px_28px] min-[720px]:row-span-2 min-[720px]:min-h-full`}>
              <p className={`${eyebrowClass} text-green`}>{t.landing.mosaic.spotlight}</p>
              <h2 className="text-[clamp(1.25rem,2vw,1.7rem)] leading-[1.08] [overflow-wrap:anywhere] min-[720px]:text-[clamp(1.6rem,2.2vw,2.15rem)]">{t.landing.mosaic.spotlightTitle}</h2>
              <span className="block h-2 w-18 bg-green" />
            </article>
            <article className={mosaicCardClass}>
              <p className={`${eyebrowClass} text-blue`}>{t.landing.mosaic.channels}</p>
              <h2 className="text-[clamp(1.25rem,2vw,1.7rem)] leading-[1.08] [overflow-wrap:anywhere]">{t.landing.mosaic.channelsTitle}</h2>
            </article>
            <article className={`${mosaicCardClass} bg-orange! text-ink`}>
              <p className={eyebrowClass}>{t.landing.mosaic.look}</p>
              <h2 className="text-[clamp(1.25rem,2vw,1.7rem)] leading-[1.08] [overflow-wrap:anywhere]">{t.landing.mosaic.lookTitle}</h2>
            </article>
          </div>
        </section>
      </div>

      <CommunityCarousel />

      <section className="grid gap-[22px]" aria-labelledby="channels-title">
        <div>
          <p className={`${eyebrowClass} text-blue`}>{t.landing.channelsEyebrow}</p>
          <h2 className="mt-2.5 max-w-[18ch] text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.05]" id="channels-title">{t.landing.channelsTitle}</h2>
        </div>
        <ul className="grid list-none gap-2.5 p-0 min-[720px]:grid-cols-2 min-[980px]:grid-cols-3">
          {channels.map((channel) => (
            <li className={cardClass} key={channel}>
              <strong className="block">{channel}</strong>
              <span className="mt-1.5 block text-[13px] leading-normal text-muted-light">{formats.filter((format) => format.channel === channel).map((format) => t.formats[format.value]).join(' · ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-[22px]" aria-labelledby="journey-title">
        <div>
          <p className={`${eyebrowClass} text-orange`}>{t.landing.journeyEyebrow}</p>
          <h2 className="mt-2.5 max-w-[18ch] text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.05]" id="journey-title">{t.landing.journeyTitle}</h2>
        </div>
        <ol className="grid list-none gap-2.5 p-0 min-[720px]:grid-cols-2 min-[980px]:grid-cols-5">
          {t.landing.journey.map((item, index) => (
            <li className={cardClass} key={item.title}>
              <span className="text-xs font-black text-orange">{String(index + 1).padStart(2, '0')}</span>
              <strong className="block">{item.title}</strong>
              <p className="mt-1.5 text-[13px] leading-normal text-muted-light">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
