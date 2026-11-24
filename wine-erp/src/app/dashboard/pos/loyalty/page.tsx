import { LoyaltyPanel } from '../LoyaltyPanel'

export const metadata = { title: 'POS — Loyalty Program' }

export default function LoyaltyPage() {
    return (
        <div className="space-y-5 max-w-screen-xl w-full mx-auto">
            <LoyaltyPanel />
        </div>
    )
}
