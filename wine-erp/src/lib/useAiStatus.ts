'use client'

import { useState, useEffect } from 'react'

interface AiStatus {
    enabled: boolean
    allowedModules: string[]
    loading: boolean
}

export function useAiStatus(module: string): AiStatus {
    const [status, setStatus] = useState<AiStatus>({
        enabled: false,
        allowedModules: [],
        loading: true,
    })

    useEffect(() => {
        fetch('/api/ai/status')
            .then(r => r.json())
            .then(data => {
                const modules = data.allowedModules ?? []
                setStatus({
                    enabled: data.enabled && modules.includes(module),
                    allowedModules: modules,
                    loading: false,
                })
            })
            .catch(() => setStatus({ enabled: true, allowedModules: [], loading: false }))
    }, [module])

    return status
}
