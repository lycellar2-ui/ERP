import { LoyaltyPanel } from '../LoyaltyPanel'

export const metadata = { title: 'POS — Loyalty Program' }

export default function LoyaltyPage() {
    return (
        <div className="space-y-6 max-w-screen-lg p-6">
            <LoyaltyPanel />
        </div>
    )
}
