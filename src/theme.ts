import { useEffect, useState } from 'react'

export function useTheme(initialDark = true) {
  const [dark, setDark] = useState(initialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return [dark, setDark] as const
}

