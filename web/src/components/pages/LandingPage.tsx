import { formats } from '../../constants'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import type { AppConfig } from '../../types'

const journey = [
  { number: '01', title: 'Describe the idea', text: 'Topic, goal, and who should care.' },
  { number: '02', title: 'Pick a channel', text: 'Instagram, LinkedIn, X, Facebook, or YouTube.' },
  { number: '03', title: 'Choose the look', text: 'Color, contrast, and the language of the post.' },
  { number: '04', title: 'Add your name', text: 'It stays on this device for the next post.' },
  { number: '05', title: 'Download the set', text: 'Pages, overview, and PDF when it is ready.' },
]

interface LandingPageProps {
  config: AppConfig | null
  canCreate: boolean
  error: string
  onStart: () => void
}

export function LandingPage({ config, canCreate, error, onStart }: LandingPageProps) {
  const channels = [...new Set(formats.map((format) => format.channel))]

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow text-pink">Builder Center</p>
          <h1 className="display-title">Your ideas. Your posts. Your AWS.</h1>
          <p className="page-lede">
            Turn a short brief into a set of posts for the channels where you share what you&apos;re building.
          </p>
          <div className="hero-actions">
            <Button onClick={onStart} disabled={!canCreate}>
              Start a post <span aria-hidden="true">↗</span>
            </Button>
            <p>Four short steps. No technical setup on this page.</p>
          </div>
          {error && <Alert role="alert">{error}</Alert>}
          {config && !canCreate && !error && <Alert>Creating posts isn&apos;t available right now.</Alert>}
        </div>
        <div className="mosaic" aria-hidden="true">
          <article className="mosaic-card mosaic-feature">
            <p className="eyebrow text-green">Spotlight</p>
            <h2>From a brief to a finished carousel.</h2>
            <span className="mosaic-bar bg-green" />
          </article>
          <article className="mosaic-card">
            <p className="eyebrow text-blue">Channels</p>
            <h2>One idea, ready for every feed.</h2>
          </article>
          <article className="mosaic-card mosaic-accent">
            <p className="eyebrow">Look</p>
            <h2>Dark, light, or both.</h2>
          </article>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="channels-title">
        <div className="section-heading">
          <p className="eyebrow text-blue">Where it can go</p>
          <h2 id="channels-title">Publish where the conversation already is.</h2>
        </div>
        <ul className="channel-list">
          {channels.map((channel) => (
            <li key={channel}>
              <strong>{channel}</strong>
              <span>{formats.filter((format) => format.channel === channel).map((format) => format.label).join(' · ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="journey-title">
        <div className="section-heading">
          <p className="eyebrow text-orange">How it works</p>
          <h2 id="journey-title">A guided brief, then the finished pages.</h2>
        </div>
        <ol className="journey-list">
          {journey.map((item) => (
            <li key={item.number}>
              <span>{item.number}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
