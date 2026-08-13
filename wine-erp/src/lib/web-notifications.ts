// ═══════════════════════════════════════════════════
// WEB NOTIFICATIONS & AUDIO ALERT UTILITY — WMS / ERP
// ═══════════════════════════════════════════════════

/**
 * Synthesizes a clean 2-tone audio chime (D5 -> A5 -> D6) using HTML5 Web Audio API.
 * Guaranteed to work without external audio file dependencies or broken links.
 */
export function playNotificationSound() {
    try {
        if (typeof window === 'undefined') return
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) return

        const ctx = new AudioContextClass()
        const now = ctx.currentTime

        // Tone 1: D5 (587.33 Hz) -> A5 (880 Hz)
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(587.33, now)
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12)
        gain1.gain.setValueAtTime(0.35, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.4)

        // Tone 2: A5 (880 Hz) -> D6 (1174.66 Hz) after 120ms
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880, now + 0.12)
        osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28)
        gain2.gain.setValueAtTime(0.001, now)
        gain2.gain.setValueAtTime(0.4, now + 0.12)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)

        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.12)
        osc2.stop(now + 0.55)
    } catch (err) {
        console.warn('[Web Audio Alert] Play sound error:', err)
    }
}

/**
 * Request permission for native Browser Desktop Notifications.
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false
    }
    if (Notification.permission === 'granted') {
        return true
    }
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
    }
    return false
}

/**
 * Trigger a native Browser Desktop Notification.
 * Appears as a desktop toast popup even when the browser tab is minimized or in background.
 */
export function sendDesktopNotification(title: string, options?: NotificationOptions & { onClickUrl?: string }) {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
        try {
            const notiOptions: any = {
                badge: '/logo.png',
                tag: 'wms-order-alert',
                renotify: true,
                ...options,
            }
            const noti = new Notification(title, notiOptions)
            if (options?.onClickUrl) {
                noti.onclick = () => {
                    window.focus()
                    window.location.href = options.onClickUrl!
                }
            }
        } catch (err) {
            console.warn('[Desktop Notification] Trigger error:', err)
        }
    }
}
