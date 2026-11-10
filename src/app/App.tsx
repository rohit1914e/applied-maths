import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DatasetProvider } from '../state/DatasetContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { Navbar } from '../site/Navbar'
import { Hero } from '../site/Hero'
import { SimulationSection } from '../site/sections/SimulationSection'
import { MissingDataSection } from '../site/sections/MissingDataSection'
import { DatasetSection } from '../site/sections/DatasetSection'
import { MethodsSection } from '../site/sections/MethodsSection'
import { ReconstructionSection } from '../site/sections/ReconstructionSection'
import { EvaluationSection } from '../site/sections/EvaluationSection'
import { ConclusionSection, Footer } from '../site/sections/ConclusionSection'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function App() {
  const page = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // Section content fades up once as it scrolls into view. With reduced motion nothing is hidden.
  useGSAP(
    () => {
      if (reduced) return
      const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]')
      gsap.set(targets, { autoAlpha: 0, y: 18 })
      ScrollTrigger.batch(targets, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, overwrite: true }),
      })
    },
    { scope: page, dependencies: [reduced] },
  )

  return (
    <DatasetProvider>
      <div ref={page}>
        <a href="#simulation" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to the simulation
        </a>
        <Navbar />
        <main>
          <Hero />
          <SimulationSection />
          <MissingDataSection />
          <DatasetSection />
          <MethodsSection />
          <ReconstructionSection />
          <EvaluationSection />
          <ConclusionSection />
        </main>
        <Footer />
      </div>
    </DatasetProvider>
  )
}
