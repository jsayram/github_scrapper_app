"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false)
  const { setTheme, theme } = useTheme()

  // Only render on client to prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Render a placeholder with the same dimensions during SSR
  if (!mounted) {
    return (
      <button
        className="rounded-md p-2 bg-muted hover:bg-muted/80 inline-flex items-center justify-center h-9 w-9"
        aria-label="Toggle theme"
        disabled
      >
        <span className="h-5 w-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-md p-2 bg-muted hover:bg-muted/80 inline-flex items-center justify-center"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}