import { useEffect, useRef, useState } from 'react'
import { getCommunityImages, type CommunityImage } from '../../api'
import { useI18n } from '../../i18n/context'
import { eyebrowClass } from '../../styles'

const refreshInterval = 60_000
const campaignThemeClasses = [
  'border-pink bg-pink',
  'border-green bg-green',
  'border-blue bg-blue',
  'border-orange bg-orange',
]

export function CommunityCarousel() {
  const { t } = useI18n()
  const [images, setImages] = useState<CommunityImage[]>([])
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    let controller: AbortController | null = null
    let lastLoaded = 0

    async function loadImages() {
      controller?.abort()
      controller = new AbortController()
      try {
        const next = await getCommunityImages(controller.signal)
        if (!active) return
        setImages(next)
        lastLoaded = Date.now()
        trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    const initialLoad = window.setTimeout(loadImages, 1_000)
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadImages()
    }, refreshInterval)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoaded >= refreshInterval) {
        void loadImages()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      controller?.abort()
      window.clearTimeout(initialLoad)
      window.clearInterval(refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (!images.length) return null

  const campaignThemes = new Map<string, string>()
  for (const image of images) {
    const campaignID = image.id.split('/', 1)[0]
    if (!campaignThemes.has(campaignID)) {
      campaignThemes.set(campaignID, campaignThemeClasses[campaignThemes.size % campaignThemeClasses.length])
    }
  }

  function move(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.82, 260), behavior: 'smooth' })
  }

  return (
    <section className="grid gap-[22px]" aria-labelledby="community-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={`${eyebrowClass} text-green`}>{t.landing.communityEyebrow}</p>
          <h2 className="mt-2.5 max-w-[22ch] text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.05]" id="community-title">
            {t.landing.communityTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-light">{t.landing.communityDescription}</p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            className="grid size-11 cursor-pointer place-items-center border border-border bg-ink text-lg text-white hover:border-blue hover:bg-blue hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            type="button"
            aria-label={t.landing.communityPrevious}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            className="grid size-11 cursor-pointer place-items-center border border-green bg-green text-lg text-ink hover:border-blue hover:bg-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            type="button"
            aria-label={t.landing.communityNext}
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-live="polite"
      >
        {images.map((image, index) => {
          const campaignID = image.id.split('/', 1)[0]
          return (
            <a
              className={`group min-w-0 basis-[82%] shrink-0 snap-start border p-2 no-underline transition-colors sm:basis-[46%] lg:basis-[31%] ${campaignThemes.get(campaignID)}`}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              key={image.id}
            >
              <span className="grid aspect-[4/5] place-items-center overflow-hidden bg-code">
                <img
                  className="block size-full object-contain transition-transform duration-200 group-hover:scale-[1.015]"
                  src={image.url}
                  alt={t.landing.communityAlt(index + 1)}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  draggable={false}
                />
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
