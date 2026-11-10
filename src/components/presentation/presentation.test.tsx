import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInitialState, presentationReducer, type PresentationState } from './presentationState'
import { handleShortcut, type ShortcutHandlers } from '../../hooks/useKeyboardShortcuts'
import App from '../../app/App'
import { CHAPTERS } from '../../app/chapters'

const builds = [3, 2, 0]

describe('presentation reducer', () => {
  const run = (...actions: Parameters<typeof presentationReducer>[1][]) =>
    actions.reduce<PresentationState>((s, a) => presentationReducer(s, a, builds), createInitialState())

  it('advances through every build before moving to the next chapter', () => {
    expect(run({ type: 'advance' })).toMatchObject({ chapter: 0, step: 1 })
    expect(run({ type: 'advance' }, { type: 'advance' }, { type: 'advance' })).toMatchObject({ chapter: 0, step: 3 })
    expect(run({ type: 'advance' }, { type: 'advance' }, { type: 'advance' }, { type: 'advance' })).toMatchObject({ chapter: 1, step: 0 })
  })

  it('moves between chapters, clamps at both ends and resets the build', () => {
    expect(run({ type: 'previous' }).chapter).toBe(0)
    expect(run({ type: 'advance' }, { type: 'next' })).toMatchObject({ chapter: 1, step: 0 })
    expect(run({ type: 'next' }, { type: 'next' }, { type: 'next' }).chapter).toBe(2)
    expect(run({ type: 'goto', chapter: 99 }).chapter).toBe(2)
    expect(run({ type: 'goto', chapter: 2 }, { type: 'advance' }).chapter).toBe(2) // last chapter has nowhere to go
  })

  it('replays the current chapter from its first build and clears pause', () => {
    const s = run({ type: 'advance' }, { type: 'togglePause' }, { type: 'replay' })
    expect(s).toMatchObject({ chapter: 0, step: 0, paused: false, replayKey: 1 })
  })

  it('restarts at chapter 1 but keeps the notes preference', () => {
    const s = run({ type: 'next' }, { type: 'toggleNotes' }, { type: 'restart' })
    expect(s).toMatchObject({ chapter: 0, step: 0, notesOpen: true })
  })

  it('has no timer-driven action: state only changes through dispatched actions', () => {
    const s = createInitialState()
    expect(presentationReducer(s, { type: 'togglePause' }, builds).chapter).toBe(0)
  })
})

describe('keyboard shortcuts', () => {
  const handlers = () =>
    ({
      next: vi.fn(),
      previous: vi.fn(),
      advance: vi.fn(),
      toggleFullscreen: vi.fn(),
      toggleNotes: vi.fn(),
      togglePause: vi.fn(),
      replay: vi.fn(),
      restart: vi.fn(),
      goto: vi.fn(),
      escape: vi.fn(),
    }) satisfies ShortcutHandlers

  const key = (k: string, target: HTMLElement = document.body, extra: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, ...extra })
    Object.defineProperty(e, 'target', { value: target })
    return e
  }

  it('maps arrows, clicker keys, space and letters', () => {
    const h = handlers()
    handleShortcut(key('ArrowRight'), h)
    handleShortcut(key('PageDown'), h)
    handleShortcut(key('ArrowLeft'), h)
    handleShortcut(key(' '), h)
    handleShortcut(key('n'), h)
    handleShortcut(key('f'), h)
    handleShortcut(key('p'), h)
    handleShortcut(key('r'), h)
    handleShortcut(key('5'), h)
    expect(h.next).toHaveBeenCalledTimes(2)
    expect(h.previous).toHaveBeenCalledTimes(1)
    expect(h.advance).toHaveBeenCalledTimes(1)
    expect(h.toggleNotes).toHaveBeenCalledTimes(1)
    expect(h.toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(h.togglePause).toHaveBeenCalledTimes(1)
    expect(h.replay).toHaveBeenCalledTimes(1)
    expect(h.goto).toHaveBeenCalledWith(4)
  })

  it('ignores keys typed into form fields and modified keys', () => {
    const h = handlers()
    const input = document.createElement('input')
    expect(handleShortcut(key('ArrowRight', input), h)).toBe(false)
    expect(handleShortcut(key('n', document.body, { ctrlKey: true }), h)).toBe(false)
    expect(h.next).not.toHaveBeenCalled()
  })

  it('lets Space press a focused button instead of advancing', () => {
    const h = handlers()
    expect(handleShortcut(key(' ', document.createElement('button')), h)).toBe(false)
    expect(h.advance).not.toHaveBeenCalled()
  })

  it('lets Escape through so the browser can exit fullscreen', () => {
    const h = handlers()
    expect(handleShortcut(key('Escape'), h)).toBe(false)
  })
})

describe('presentation shell', () => {
  it('opens on chapter 1 and navigates with the keyboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByTestId('chapter-1')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByTestId('chapter-2')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(await screen.findByTestId('chapter-1')).toBeInTheDocument()
    await user.keyboard('8')
    expect(await screen.findByTestId('chapter-8')).toBeInTheDocument()
  })

  it('reveals builds with Space and starts with the Start presentation control', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('chapter-1')
    const problem = screen.getByText('What problem are we solving?').closest('[aria-hidden]')!
    expect(problem).toHaveAttribute('aria-hidden', 'true')
    await user.keyboard('   ')
    expect(problem).toHaveAttribute('aria-hidden', 'false')
    await user.click(screen.getByRole('button', { name: 'Start presentation' }))
    expect(await screen.findByTestId('chapter-2')).toBeInTheDocument()
  })

  it('renders presenter notes outside the stage and fullscreen root', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('chapter-1')
    expect(screen.queryByTestId('presenter-notes')).toBeNull()
    await user.keyboard('n')
    const notes = await screen.findByTestId('presenter-notes')
    expect(screen.getByTestId('stage')).not.toContainElement(notes)
    expect(screen.getByTestId('presentation-root')).not.toContainElement(notes)
    expect(within(notes).getByText(CHAPTERS[0].notes.questions[0].q)).toBeInTheDocument()
  })

  it('offers the chapter list and every control', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('chapter-1')
    const bar = screen.getByTestId('control-bar')
    for (const name of [/Previous chapter/, /Next chapter/, /Replay/, /Pause/, /Notes/, /Fullscreen/, /Restart/]) {
      expect(within(bar).getAllByRole('button', { name }).length).toBeGreaterThan(0)
    }
    await user.click(within(bar).getByRole('button', { name: /Understanding Network Latency/ }))
    const menu = screen.getByRole('menu', { name: 'Chapters' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(8)
    await user.click(within(menu).getByRole('menuitem', { name: /How Accurate/ }))
    expect(await screen.findByTestId('chapter-7')).toBeInTheDocument()
  })

  it('pauses and resumes animation from the control bar', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('chapter-1')
    await user.click(screen.getByRole('button', { name: /Pause/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Animation paused')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Resume/ }))
    })
    expect(screen.queryByText('Animation paused')).toBeNull()
  })
})
