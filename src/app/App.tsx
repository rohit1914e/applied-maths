import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { PresentationShell } from '../components/presentation/PresentationShell'
import { DatasetProvider } from '../state/DatasetContext'
import { CHAPTERS } from './chapters'

gsap.registerPlugin(useGSAP)

export default function App() {
  return (
    <DatasetProvider>
      <PresentationShell chapters={CHAPTERS} />
    </DatasetProvider>
  )
}
