import type { ChapterDefinition } from '../../types/presentation'

/**
 * Presenter notes. Rendered only outside the stage element (drawer or separate window),
 * so neither fullscreen projection nor a stage screenshot can include them.
 */
export function PresenterNotesPanel({
  chapter,
  step,
  onPopOut,
  onClose,
  inWindow = false,
}: {
  chapter: ChapterDefinition
  step: number
  onPopOut?: () => void
  onClose?: () => void
  inWindow?: boolean
}) {
  const { notes } = chapter
  return (
    <section
      aria-label="Presenter notes"
      data-testid="presenter-notes"
      className={`presenter-only flex h-full flex-col overflow-y-auto bg-paper text-charcoal ${inWindow ? 'p-8' : 'border-l-2 border-rule p-6'}`}
    >
      <div className="flex flex-col-reverse gap-3">
        <div>
          <p className="text-[14px] font-semibold text-muted">
            Presenter notes, chapter {chapter.number}
            {chapter.builds > 0 && `, build ${step} of ${chapter.builds}`}
          </p>
          <h2 className="mt-1 font-serif text-[24px] leading-tight">{chapter.title}</h2>
        </div>
        {!inWindow && (
          <div className="flex shrink-0 justify-end gap-2">
            {onPopOut && (
              <button type="button" onClick={onPopOut} className="rounded border border-charcoal px-2 py-1 text-[13px] font-semibold hover:bg-charcoal hover:text-ivory">
                Open in window
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Hide presenter notes" className="rounded border border-charcoal px-2 py-1 text-[13px] font-semibold hover:bg-charcoal hover:text-ivory">
                Hide
              </button>
            )}
          </div>
        )}
      </div>

      {chapter.buildLabels.length > 0 && (
        <ol className="mt-4 space-y-1 text-[14px]">
          {chapter.buildLabels.map((label, i) => (
            <li key={label} className={i + 1 <= step ? 'text-charcoal' : 'text-muted'}>
              <span className="num mr-2">{i + 1 <= step ? '●' : '○'}</span>
              Space {i + 1}: {label}
            </li>
          ))}
        </ol>
      )}

      <h3 className="mt-5 text-[15px] font-bold text-crimson">What to explain</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-snug">
        {notes.explain.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h3 className="mt-5 text-[15px] font-bold text-crimson">Suggested narration</h3>
      <p className="mt-2 font-serif text-[16px] leading-relaxed italic">{notes.narration}</p>

      {notes.formula && (
        <>
          <h3 className="mt-5 text-[15px] font-bold text-crimson">Formula walkthrough</h3>
          <p className="mt-2 text-[15px] leading-snug whitespace-pre-line">{notes.formula}</p>
        </>
      )}

      <h3 className="mt-5 text-[15px] font-bold text-crimson">Terminology</h3>
      <dl className="mt-2 space-y-1.5 text-[15px] leading-snug">
        {notes.terms.map((t) => (
          <div key={t.term}>
            <dt className="inline font-semibold">{t.term}: </dt>
            <dd className="inline">{t.meaning}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 text-[15px] font-bold text-crimson">Questions an examiner might ask</h3>
      <dl className="mt-2 space-y-3 pb-4 text-[15px] leading-snug">
        {notes.questions.map((item) => (
          <div key={item.q}>
            <dt className="font-semibold">{item.q}</dt>
            <dd className="mt-0.5 text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
