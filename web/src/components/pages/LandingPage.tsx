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

      <section className="grid gap-7" aria-labelledby="builder-center-example-title">
        <div className="max-w-4xl border-l-4 border-l-green pl-[18px]">
          <p className={`${eyebrowClass} text-green`}>{t.landing.builderCenterEyebrow}</p>
          <h2
            className="mt-2.5 max-w-[22ch] text-[clamp(1.8rem,4vw,3rem)] leading-[1.02] tracking-[-.035em]"
            id="builder-center-example-title"
          >
            {t.landing.builderCenterTitle}
          </h2>
          <p className="mt-4 max-w-[76ch] text-base leading-[1.7] text-muted-light max-[520px]:text-[13px] max-[520px]:leading-[1.55]">
            {t.landing.builderCenterDescription}
          </p>
        </div>
        <figure className="mx-auto w-full max-w-[960px] overflow-hidden border border-grid bg-panel p-2 shadow-[8px_8px_0_#00e582] max-[520px]:p-1 max-[520px]:shadow-[5px_5px_0_#00e582]">
          <img
            className="block h-auto w-full"
            src="/builder-center-example.png"
            alt={t.landing.builderCenterAlt}
            loading="lazy"
          />
        </figure>
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

      <footer className="grid overflow-hidden border border-grid bg-panel/90 min-[720px]:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]" aria-labelledby="home-footer-title">
        <div className="grid content-center gap-3 p-7 min-[720px]:border-r min-[720px]:border-grid min-[980px]:p-10">
          <p className={`${eyebrowClass} text-pink`}>{t.landing.footerEyebrow}</p>
          <h2 className="max-w-[18ch] text-[clamp(1.6rem,4vw,2.5rem)] leading-[1.04]" id="home-footer-title">
            {t.landing.footerTitle}
          </h2>
          <p className="max-w-[58ch] text-[13px] leading-relaxed text-muted-light">{t.landing.footerDescription}</p>
        </div>
        <nav className="grid border-t border-grid min-[720px]:border-t-0" aria-label={t.landing.socialLinksLabel}>
          <a
            className="group grid min-h-24 grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-grid px-5 py-4 text-white no-underline transition-colors hover:bg-code focus-visible:bg-code focus-visible:outline-none"
            href="https://github.com/pedroborgesdev"
            target="_blank"
            rel="noreferrer"
          >
            <span className="grid size-12 place-items-center border border-pink bg-pink text-ink" aria-hidden="true">
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.29-5.28-1.29-5.28-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.12c.98 0 1.95.13 2.87.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05a4.45 4.45 0 0 1 1.19 3.09c0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
              </svg>
            </span>
            <span className="min-w-0">
              <strong className="block text-base">GitHub</strong>
              <span className="block truncate text-xs text-muted-light">@pedroborgesdev</span>
            </span>
            <span className="text-xl text-pink transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">↗</span>
          </a>
          <a
            className="group grid min-h-24 grid-cols-[48px_1fr_auto] items-center gap-4 px-5 py-4 text-white no-underline transition-colors hover:bg-code focus-visible:bg-code focus-visible:outline-none"
            href="https://linkedin.com/in/pedrofilipeborges"
            target="_blank"
            rel="noreferrer"
          >
            <span className="grid size-12 place-items-center border border-blue bg-blue text-ink" aria-hidden="true">
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.41v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.04H3.54V8.98H7.1v11.47ZM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0Z" />
              </svg>
            </span>
            <span className="min-w-0">
              <strong className="block text-base">LinkedIn</strong>
              <span className="block truncate text-xs text-muted-light">Pedro Filipe Borges</span>
            </span>
            <span className="text-xl text-blue transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">↗</span>
          </a>
        </nav>
      </footer>
    </main>
  )
}
