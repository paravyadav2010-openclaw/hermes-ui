import { useEffect, useState } from 'react'

const QUERY = '(hover: none) and (pointer: coarse)'

export function useMobile(): boolean {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const handler = () => setMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return mobile
}

export const useIsMobile = useMobile
