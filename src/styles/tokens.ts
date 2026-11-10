/**
 * Colour tokens for SVG charts and illustrations. These mirror the CSS variables in
 * index.css (@theme), which are the source of truth for everything styled with classes.
 * Keep the two in step: components must not use colour literals of their own.
 */
export const COLORS = {
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  ink: '#111827',
  muted: '#64748B',
  axis: '#94A3B8',
  grid: '#E2E8F0',
  accent: '#2563EB',

  actual: '#2563EB',
  estimate: '#F59E0B',
  estimateInk: '#B45309',
  missing: '#EF4444',
  missingInk: '#DC2626',
  success: '#16A34A',
  failure: '#DC2626',

  panel: '#0F172A',
  panel2: '#1E293B',
  panelLine: '#334155',
  panelInk: '#F8FAFC',
  panelMuted: '#94A3B8',
  panelAccent: '#38BDF8',
  panelAlert: '#F87171',
  panelDevice: '#CBD5E1',
} as const

/** One colour per interpolation method, used for series that compare methods. */
export const METHOD_COLORS = {
  lagrange: '#2563EB',
  newton: '#38BDF8',
  spline: '#0F172A',
} as const

/** Distinct but quiet line colours for the Lagrange basis polynomials. */
export const BASIS_COLORS = ['#2563EB', '#0EA5E9', '#6366F1', '#0F172A', '#64748B', '#38BDF8', '#1D4ED8', '#334155', '#7DD3FC', '#94A3B8'] as const
