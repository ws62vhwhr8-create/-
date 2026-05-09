'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

// next-themes injects an inline <script> for FOUC prevention.
// React 19 warns about script tags rendered inside components
// (they are intentionally not re-executed on client re-renders).
// This is a known library-level pattern; suppress the specific warning.
if (typeof console !== 'undefined') {
  const _originalConsoleError = console.error.bind(console)
  console.error = (...args: Parameters<typeof console.error>) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Encountered a script tag while rendering React component')
    ) {
      return
    }
    _originalConsoleError(...args)
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
