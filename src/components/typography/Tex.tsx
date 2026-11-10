import katex from 'katex'
import 'katex/dist/katex.min.css'
import { memo } from 'react'

/**
 * Typesets a TeX expression with KaTeX. Expressions come from the app's own source and
 * algorithm output (numbers), never from user text; KaTeX's `trust` stays off.
 */
export const Tex = memo(function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' })
  const Tag = display ? 'div' : 'span'
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
})
