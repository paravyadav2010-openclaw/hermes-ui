import { useEffect, useState } from 'react'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

export function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('mobile') === '1' || urlParams.get('mode') === 'mobile') return true
    if (urlParams.get('mobile') === '0' || urlParams.get('mode') === 'desktop') return false
    
    const isMobileUA = /iPhone|iPod|Android|Mobile|iPad/i.test(navigator.userAgent)
    const isNarrow = window.innerWidth < 1024
    const isTouch = window.matchMedia(TOUCH_QUERY).matches
    return isMobileUA || isNarrow || isTouch
  })

  useEffect(() => {
    const check = () => {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('mobile') === '1' || urlParams.get('mode') === 'mobile') {
        setMobile(true)
        return
      }
      if (urlParams.get('mobile') === '0' || urlParams.get('mode') === 'desktop') {
        setMobile(false)
        return
      }

      const isMobileUA = /iPhone|iPod|Android|Mobile|iPad/i.test(navigator.userAgent)
      const isNarrow = window.innerWidth < 1024
      const isTouch = window.matchMedia(TOUCH_QUERY).matches
      setMobile(isMobileUA || isNarrow || isTouch)
    }

    const mql = window.matchMedia(TOUCH_QUERY)
    mql.addEventListener('change', check)
    window.addEventListener('resize', check)
    return () => {
      mql.removeEventListener('change', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  return mobile
}

export const useIsMobile = useMobile
