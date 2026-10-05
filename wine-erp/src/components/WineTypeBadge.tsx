import { Badge } from '@/components/ui'

/** Category palette for wine types — intentionally separate from status tones. */
export const WINE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
    RED: { label: 'Vang đỏ', className: 'bg-rose-50 text-rose-800 border-rose-200' },
    WHITE: { label: 'Vang trắng', className: 'bg-amber-50 text-amber-800 border-amber-200' },
    SPARKLING: { label: 'Vang nổ', className: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
    ROSE: { label: 'Vang hồng', className: 'bg-pink-50 text-pink-800 border-pink-200' },
    FORTIFIED: { label: 'Fortified', className: 'bg-orange-50 text-orange-800 border-orange-200' },
    DESSERT: { label: 'Dessert', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
}

export function WineTypeBadge({ type }: { type: string | null | undefined }) {
    if (!type) return null
    const cfg = WINE_TYPE_CONFIG[type]
    return <Badge className={cfg?.className}>{cfg?.label ?? type}</Badge>
}
