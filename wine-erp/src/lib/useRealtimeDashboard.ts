'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { RealtimeChannelConfig } from '@/app/dashboard/actions'

type RealtimeEvent = {
    channel: string
    table: string
    type: string
    timestamp: Date
    payload: any
}

export function useRealtimeDashboard(channels: RealtimeChannelConfig[]) {
    const [events, setEvents] = useState<RealtimeEvent[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    const clearEvents = useCallback(() => setEvents([]), [])

    useEffect(() => {
        if (channels.length === 0) return

        const supabase = createClient()
        const subscriptions: any[] = []

        for (const config of channels) {
            const channel = supabase
                .channel(config.channel)
                .on(
                    'postgres_changes',
                    {
                        event: config.event,
                        schema: 'public',
                        table: config.table,
                        filter: config.filter,
                    },
                    (payload: any) => {
                        const event: RealtimeEvent = {
                            channel: config.channel,
                            table: config.table,
                            type: payload.eventType,
                            timestamp: new Date(),
                            payload: payload.new ?? payload.old,
                        }
                        setEvents(prev => [event, ...prev].slice(0, 50))
                        setLastUpdate(new Date())
                    }
                )
                .subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        setIsConnected(true)
                    }
                })

            subscriptions.push(channel)
        }

        return () => {
            subscriptions.forEach(ch => {
                supabase.removeChannel(ch)
            })
            setIsConnected(false)
        }
    }, [channels])

    return { events, isConnected, lastUpdate, clearEvents }
}
