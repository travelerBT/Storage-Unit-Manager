import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService } from '@/lib/services'
import type { Facility } from '@/types'

interface FacilityContextValue {
  facilityId: string | null
  facility: Facility | null
  facilities: Facility[]
  setFacilityId: (id: string) => void
}

const FacilityContext = createContext<FacilityContextValue | null>(null)

export function FacilityProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const [facilityId, setFacilityId] = useState<string | null>(null)

  const { data: facilities = [] } = useQuery({
    queryKey: ['manager-facilities', appUser?.id],
    queryFn: () => facilityService.listByManager(appUser!.id),
    enabled: !!appUser && ((appUser.roles ?? [appUser.role]).includes('manager')),
  })

  // Default to first facility when loaded
  useEffect(() => {
    if (facilities.length > 0 && !facilityId) {
      setFacilityId(facilities[0].id)
    }
  }, [facilities, facilityId])

  const facility = facilities.find((f) => f.id === facilityId) ?? null

  return (
    <FacilityContext.Provider value={{ facilityId, facility, facilities, setFacilityId }}>
      {children}
    </FacilityContext.Provider>
  )
}

export function useFacility() {
  const ctx = useContext(FacilityContext)
  if (!ctx) throw new Error('useFacility must be used inside FacilityProvider')
  return ctx
}

/** Returns null when used outside FacilityProvider (e.g. in shared layouts). */
export function useFacilityOptional() {
  return useContext(FacilityContext)
}
