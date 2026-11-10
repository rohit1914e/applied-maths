import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ChapterProps } from '../../types/presentation'
import { Reveal } from '../../components/presentation/ChapterFrame'
import { TopologyIllustration } from '../../components/network/TopologyIllustration'
import { TraceMotif } from '../../components/graphs/TraceMotif'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const BLOCKS = [
  {
    step: 1,
    heading: 'What is network latency?',
    body: 'The time a message needs to cross the network. We measure it as round-trip time, in milliseconds.',
  },
  {
    step: 1,
    heading: 'What is ping?',
    body: 'A probe that sends an echo request and times the reply. Each ping produces one round-trip time.',
  },
  {
    step: 2,
    heading: 'Why measure response time?',
    body: 'Calls, games and web pages slow down as latency rises. Regular pings show when and where it happens.',
  },
  {
    step: 3,
    heading: 'What problem are we solving?',
    body: 'Some pings leave no record. We estimate those values with numerical interpolation and test how accurate the estimates are.',
  },
] as const

export default function Introduction({ step, onNextChapter }: ChapterProps) {
  const scope = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      if (reduced) return
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('[data-anim="title"]', { opacity: 0, duration: 0.9 })
        .from('[data-anim="subtitle"]', { opacity: 0, duration: 0.6 }, 0.4)
        .from('[data-anim="trace"]', { opacity: 0, duration: 1 }, 0.6)
    },
    { scope, dependencies: [reduced] },
  )

  return (
    <div ref={scope} className="absolute inset-0 px-[104px] pt-[84px]">
      <div className="grid grid-cols-[930px_1fr] gap-x-[60px]">
        <div>
          <p className="font-serif text-[26px] text-muted italic">A numerical methods capstone</p>
          <h1 data-anim="title" className="display-title mt-4 text-[108px] text-charcoal">
            Network Latency Predictor
          </h1>
          <p data-anim="subtitle" className="mt-4 font-serif text-[38px] leading-tight text-brown italic">
            Interpolating missing ping measurements
          </p>

          <div className="mt-9 flex items-baseline gap-5 border-t-2 border-rule pt-6">
            <span className="display-title text-[44px] leading-none text-crimson" aria-hidden="true">
              01
            </span>
            <h2 className="section-heading text-charcoal">
              <span className="sr-only">Chapter 1: </span>Understanding Network Latency
            </h2>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-12 gap-y-6">
            {BLOCKS.map((b) => (
              <Reveal key={b.heading} visible={step >= b.step}>
                <h3 className="font-serif text-[27px] font-medium text-charcoal">{b.heading}</h3>
                <p className="small-copy mt-1.5 text-muted">{b.body}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <TopologyIllustration width={740} height={530} />
          <button type="button" className="btn mt-6" onClick={onNextChapter}>
            Start presentation
          </button>
        </div>
      </div>

      <div data-anim="trace" className="absolute inset-x-[104px] bottom-[44px]">
        <TraceMotif width={1712} height={92} />
        <p className="mt-4 flex justify-between text-[18px] text-muted">
          <span>One probe per second. The hollow crimson markers are pings that left no record.</span>
          <span className="font-serif italic">Press Space to continue</span>
        </p>
      </div>
    </div>
  )
}
