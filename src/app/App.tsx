import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ExperienceShell } from '../experience/ExperienceShell'
import { MotionProvider } from '../experience/motion'
import { DatasetProvider } from '../state/DatasetContext'
import { SCENES } from './scenes'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function App() {
  return (
    <MotionProvider>
      <DatasetProvider>
        <ExperienceShell scenes={SCENES} />
      </DatasetProvider>
    </MotionProvider>
  )
}
