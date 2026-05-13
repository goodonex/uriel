import { Outlet } from 'react-router-dom'

/** Ein Modul, das nur den verschachtelten Brand-Route-Outlet rendert (Phase-4-Fallback). */
export function OutletHostModule() {
  return <Outlet />
}
