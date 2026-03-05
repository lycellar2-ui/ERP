'use server'

import { getActiveDrivers } from '../actions'
import { ShipperView } from './ShipperView'

export default async function ShipperPage() {
    const drivers = await getActiveDrivers()
    return <ShipperView drivers={drivers} />
}
