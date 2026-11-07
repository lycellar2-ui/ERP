'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Minus, Plus, Search } from 'lucide-react'
import {
    addShowroomVintage, getShowroomCount, renameShowroomSpots, saveShowroomCount,
    saveShowroomNote, setShowroomItemPackSize, setShowroomRecheck,
} from './actions'
import {
    buildCsv, calcCaseLooseTotal, canRecheck, checkState, cleanLabel, entryCaseLoose,
    isCaseSpot, MAX_NOTE, normalizeSearch, normalizeVintage, packSizeOf, sortItems, summarize,
    type ShowroomCheck, type ShowroomData, type ShowroomEntry, type ShowroomItem, type ShowroomNote, type ShowroomSpot,
} from './logic'

type CountFilter = 'all' | 'done' | 'todo' | 'recheck'

type View = 'spots' | 'count' | 'sum' | 'pack'
type PackFilter = 'all' | '12' | '6'
type SumMode = 'wine' | 'spot' | 'people' | 'missing' | 'posm' | 'notes'
const SUM_MODES: SumMode[] = ['wine', 'spot', 'people', 'missing', 'posm', 'notes']

const WHO_KEY = 'kk_who'
const PENDING_KEY = 'kk_pending' // numbers typed but not yet confirmed by the server
const NOTE_DRAFT = 'kk_note|' // + who|spotId|itemId → note being typed, not saved yet
const POLL_MS = 10_000
const SAVE_DELAY_MS = 800

type OverrideValue = {
    qty: number | null
    cases?: number | null
    loose?: number | null
}

const k = (spotId: string, itemId: string) => `${spotId}|${itemId}`
const fmt = (n: number) => n.toLocaleString('vi-VN')
const when = (iso: string) => {
    const t = new Date(iso)
    return `${t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${t.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
}
const unitOf = (spot?: ShowroomSpot) => (spot?.kind === 'POSM' ? ['món', 'cái'] : ['mã', 'chai'])

export function ShowroomCountClient({ initial, initialError }: { initial: ShowroomData | null; initialError: string | null }) {
    const [data, setData] = useState<ShowroomData>(initial ?? { spots: [], items: [], entries: [], checks: [] })
    const [loadError, setLoadError] = useState<string | null>(initialError)
    const [who, setWho] = useState<string | null>(null)
    const [view, setView] = useState<View>('spots')
    const [spotId, setSpotId] = useState<string | null>(null)
    const [q, setQ] = useState('')
    const [filter, setFilter] = useState<CountFilter>('all')
    const [homeQ, setHomeQ] = useState('')
    const [sumMode, setSumMode] = useState<SumMode>('wine')
    const [sumQ, setSumQ] = useState('')
    const [packQ, setPackQ] = useState('')
    const [packFilter, setPackFilter] = useState<PackFilter>('all')
    // Local edits not yet confirmed by the server; they win over polled data.
    const [overrides, setOverrides] = useState<Map<string, OverrideValue>>(new Map())
    const [saving, setSaving] = useState<Set<string>>(new Set())
    const [errors, setErrors] = useState<Map<string, string>>(new Map())
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    const inflight = useRef(new Set<string>())
    const latest = useRef(overrides)
    useEffect(() => { latest.current = overrides }, [overrides])
    // flush re-schedules itself while a save for the same row is in flight
    const flushRef = useRef<(sId: string, itemId: string) => void>(() => {})

    useEffect(() => {
        try { setWho(localStorage.getItem(WHO_KEY) || '') } catch { setWho('') }
        // F5 returns to the same screen: view/spot/tab live in the URL (?v=count&s=t1-1, ?v=sum&m=people, ?v=pack)
        const p = new URLSearchParams(window.location.search)
        const v = p.get('v'), s = p.get('s'), m = p.get('m') as SumMode | null
        if (v === 'count' && s) { setSpotId(s); setView('count') }
        else if (v === 'sum') { setView('sum'); if (m && SUM_MODES.includes(m)) setSumMode(m) }
        else if (v === 'pack') { setView('pack') }
    }, [])

    useEffect(() => {
        if (who === null) return
        const p = new URLSearchParams()
        if (view === 'count' && spotId) { p.set('v', 'count'); p.set('s', spotId) }
        if (view === 'sum') { p.set('v', 'sum'); p.set('m', sumMode) }
        if (view === 'pack') { p.set('v', 'pack') }
        const qs = p.toString()
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    }, [who, view, spotId, sumMode])

    const refresh = useCallback(async () => {
        const res = await getShowroomCount()
        if (res.success && res.data) { setData(res.data); setLoadError(null) }
        else if (!res.success) setLoadError(res.error)
    }, [])

    // Poll so several people counting at once see each other's numbers.
    useEffect(() => {
        const id = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
        const onVis = () => { if (document.visibilityState === 'visible') refresh() }
        document.addEventListener('visibilitychange', onVis)
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
    }, [refresh])

    // Every person keeps their own number per spot + item; group them per cell.
    const byCell = useMemo(() => {
        const m = new Map<string, ShowroomEntry[]>()
        for (const e of data.entries) { const key = k(e.spotId, e.itemId); m.set(key, [...(m.get(key) ?? []), e]) }
        return m
    }, [data.entries])
    const mineOf = (sId: string, itemId: string) => byCell.get(k(sId, itemId))?.find(e => e.countedBy === who)
    const othersOf = (sId: string, itemId: string) => (byCell.get(k(sId, itemId)) ?? []).filter(e => e.countedBy !== who)
    const notesByCell = useMemo(() => {
        const m = new Map<string, ShowroomNote[]>()
        for (const n of data.notes ?? []) { const key = k(n.spotId, n.itemId); m.set(key, [...(m.get(key) ?? []), n]) }
        return m
    }, [data.notes])
    const spotById = useMemo(() => new Map(data.spots.map(s => [s.id, s])), [data.spots])
    const groups = useMemo(() => {
        const out: Array<{ name: string; kind: string; spots: ShowroomSpot[] }> = []
        for (const s of data.spots) {
            let g = out.find(x => x.name === s.groupName)
            if (!g) out.push(g = { name: s.groupName, kind: s.kind, spots: [] })
            g.spots.push(s)
        }
        return out
    }, [data.spots])
    const wineItems = useMemo(() => sortItems(data.items.filter(i => i.kind !== 'POSM')), [data.items])
    const posmItems = useMemo(() => data.items.filter(i => i.kind === 'POSM').sort((a, b) => a.sortOrder - b.sortOrder), [data.items])

    const qtyOf = (sId: string, itemId: string): number | null => {
        const key = k(sId, itemId)
        return overrides.has(key) ? overrides.get(key)!.qty : mineOf(sId, itemId)?.qty ?? null
    }

    const caseLooseOf = (sId: string, item: ShowroomItem): { cases: number | null; loose: number | null; qty: number | null } => {
        const key = k(sId, item.id)
        const pack = packSizeOf(item) ?? 6
        if (overrides.has(key)) {
            const ov = overrides.get(key)!
            return { cases: ov.cases ?? null, loose: ov.loose ?? null, qty: ov.qty }
        }
        const mine = mineOf(sId, item.id)
        if (!mine) return { cases: null, loose: null, qty: null }
        if (mine.cases !== undefined && mine.cases !== null || mine.loose !== undefined && mine.loose !== null) {
            return { cases: mine.cases ?? null, loose: mine.loose ?? null, qty: mine.qty }
        }
        const cl = entryCaseLoose(mine, pack)
        return { cases: cl.cases, loose: cl.loose, qty: cl.qty }
    }

    const flush = useCallback(async (sId: string, itemId: string) => {
        const key = k(sId, itemId)
        timers.current.delete(key)
        if (inflight.current.has(key)) { timers.current.set(key, setTimeout(() => flushRef.current(sId, itemId), 400)); return }
        if (!latest.current.has(key) || !who) return
        const ov = latest.current.get(key)!
        inflight.current.add(key)
        setSaving(s => new Set(s).add(key))
        const res = await saveShowroomCount({
            spotId: sId,
            itemId,
            qty: ov.qty,
            ...(ov.cases !== undefined || ov.loose !== undefined ? { cases: ov.cases ?? null, loose: ov.loose ?? null } : {}),
            countedBy: who,
        })
        inflight.current.delete(key)
        setSaving(s => { const n = new Set(s); n.delete(key); return n })
        if (res.success) {
            setData(d => {
                const rest = d.entries.filter(e => !(e.spotId === sId && e.itemId === itemId && e.countedBy === who))
                const next: ShowroomEntry[] = ov.qty === null ? rest : [
                    ...rest,
                    {
                        spotId: sId,
                        itemId,
                        qty: ov.qty,
                        cases: ov.cases ?? null,
                        loose: ov.loose ?? null,
                        countedBy: who,
                        countedAt: new Date().toISOString(),
                    },
                ]
                return { ...d, entries: next }
            })
            // Drop the override only if nothing newer was typed meanwhile.
            setOverrides(o => {
                const cur = o.get(key)
                if (timers.current.has(key) || !cur || cur.qty !== ov.qty || cur.cases !== ov.cases || cur.loose !== ov.loose) return o
                const n = new Map(o); n.delete(key); return n
            })
        } else {
            setErrors(e => new Map(e).set(key, res.error))
        }
    }, [who])
    useEffect(() => { flushRef.current = flush }, [flush])

    // ── Reload safety ──
    const replayed = useRef(false)
    useEffect(() => {
        if (!who || replayed.current) return
        replayed.current = true
        try {
            const raw = localStorage.getItem(PENDING_KEY)
            const pending = raw ? JSON.parse(raw) as { who: string; items: Array<[string, OverrideValue | number | null]> } : null
            if (pending?.who !== who || !pending.items?.length) return
            const normalized: Array<[string, OverrideValue]> = pending.items.map(([key, val]) => [
                key,
                typeof val === 'object' && val !== null && 'qty' in val ? val : { qty: val as number | null },
            ])
            setOverrides(new Map(normalized))
            for (const [key] of normalized) {
                const [sId, itemId] = key.split('|')
                timers.current.set(key, setTimeout(() => flushRef.current(sId, itemId), 300))
            }
        } catch { /* storage unavailable: nothing to replay */ }
    }, [who])

    useEffect(() => {
        if (!who || !replayed.current) return
        try {
            if (overrides.size) localStorage.setItem(PENDING_KEY, JSON.stringify({ who, items: [...overrides] }))
            else localStorage.removeItem(PENDING_KEY)
        } catch { /* private mode: in-memory only */ }
    }, [overrides, who])

    useEffect(() => {
        const flushAll = () => {
            for (const [key, t] of [...timers.current]) {
                clearTimeout(t)
                const [sId, itemId] = key.split('|')
                flushRef.current(sId, itemId)
            }
        }
        const onHide = () => { if (document.visibilityState === 'hidden') flushAll() }
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!timers.current.size && !inflight.current.size) return
            flushAll()
            e.preventDefault()
        }
        document.addEventListener('visibilitychange', onHide)
        window.addEventListener('pagehide', flushAll)
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => {
            document.removeEventListener('visibilitychange', onHide)
            window.removeEventListener('pagehide', flushAll)
            window.removeEventListener('beforeunload', onBeforeUnload)
        }
    }, [])

    const setQty = (sId: string, itemId: string, qty: number | null, delay = SAVE_DELAY_MS) => {
        const key = k(sId, itemId)
        setOverrides(o => new Map(o).set(key, { qty }))
        setErrors(e => { if (!e.has(key)) return e; const n = new Map(e); n.delete(key); return n })
        clearTimeout(timers.current.get(key))
        timers.current.set(key, setTimeout(() => flush(sId, itemId), delay))
    }

    const setCaseLoose = (sId: string, item: ShowroomItem, cases: number | null, loose: number | null, delay = SAVE_DELAY_MS) => {
        const key = k(sId, item.id)
        const pack = packSizeOf(item) ?? 6
        const next = calcCaseLooseTotal(cases, loose, pack)
        setOverrides(o => new Map(o).set(key, next))
        setErrors(e => { if (!e.has(key)) return e; const n = new Map(e); n.delete(key); return n })
        clearTimeout(timers.current.get(key))
        timers.current.set(key, setTimeout(() => flush(sId, item.id), delay))
    }

    const openSpot = (id: string, search = '') => {
        setSpotId(id); setQ(search); setFilter('all'); setView('count'); window.scrollTo(0, 0)
    }

    if (who === null) return null
    if (!who) return (
        <Welcome
            previous={(() => { try { return localStorage.getItem(WHO_KEY) ?? '' } catch { return '' } })()}
            onDone={name => { try { localStorage.setItem(WHO_KEY, name) } catch { /* private mode */ } setOverrides(new Map()); setWho(name) }}
        />
    )

    const merged = mergedEntries(data.entries, overrides, who)
    const summary = summarize({ ...data, entries: merged })
    const header = (title: string, eyebrow: string) => (
        <div className="mb-3 flex items-end justify-between gap-3">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">{eyebrow}</div>
                <h1 className="mt-1 text-2xl font-extrabold text-lys-primary">{title}</h1>
            </div>
            <div className="text-right text-[13px] text-lys-muted">
                Người kiểm: <b className="text-lys-primary">{who}</b><br />
                <button className="font-semibold text-lys-teal-strong" onClick={() => setWho('')}>Đổi tên</button>
            </div>
        </div>
    )
    const errorNote = loadError && <p className="rounded-lg border border-dashed border-tone-danger-border p-3 text-sm text-tone-danger-fg">{loadError}</p>

    return (
        <div className="min-h-dvh bg-lys-bg text-lys-primary tabular-nums">
            <div className="mx-auto max-w-xl px-4 pb-28 pt-3">
                {view === 'spots' && (
                    <SpotsView
                        header={header('Chọn vị trí', 'Kiểm kê showroom · ' + new Date().toLocaleDateString('vi-VN'))}
                        errorNote={errorNote}
                        groups={groups}
                        summary={summary}
                        homeQ={homeQ}
                        setHomeQ={setHomeQ}
                        items={[...wineItems, ...posmItems]}
                        entries={merged}
                        spotById={spotById}
                        onOpen={openSpot}
                        onSummary={() => { setView('sum'); window.scrollTo(0, 0) }}
                        onRenamed={refresh}
                    />
                )}
                {view === 'count' && spotId && spotById.get(spotId) && (
                    <CountView
                        spot={spotById.get(spotId)!}
                        items={spotById.get(spotId)!.kind === 'POSM' ? posmItems : wineItems}
                        allWine={wineItems}
                        q={q} setQ={setQ} filter={filter} setFilter={setFilter}
                        qtyOf={qtyOf} setQty={setQty}
                        caseLooseOf={caseLooseOf} setCaseLoose={setCaseLoose}
                        entryOf={(itemId: string) => mineOf(spotId, itemId)}
                        othersOf={(itemId: string) => othersOf(spotId, itemId)}
                        checkOf={(itemId: string) => data.checks.find(c => c.spotId === spotId && c.itemId === itemId)}
                        onRecheck={async (itemId: string, checked: boolean) => {
                            const res = await setShowroomRecheck({ spotId, itemId, checkedBy: who, checked })
                            if (res.success) await refresh()
                            return res.success ? null : res.error
                        }}
                        notesOf={(itemId: string) => notesByCell.get(k(spotId, itemId)) ?? []}
                        onSaveNote={async (itemId: string, note: string) => {
                            const res = await saveShowroomNote({ spotId, itemId, note, writtenBy: who })
                            if (res.success) await refresh()
                            return res.success ? null : res.error
                        }}
                        saving={saving} errors={errors}
                        spotSummary={summary.spots.find(s => s.spot.id === spotId)}
                        errorNote={errorNote}
                        who={who}
                        onBack={() => { setView('spots'); window.scrollTo(0, 0) }}
                        onAdded={async (code) => { await refresh(); setQ(code) }}
                    />
                )}
                {view === 'sum' && (
                    <SummaryView
                        header={header('Tổng hợp', 'Kết quả đợt kiểm')}
                        errorNote={errorNote}
                        summary={summary}
                        groups={groups}
                        notes={data.notes ?? []}
                        items={data.items}
                        mode={sumMode} setMode={setSumMode}
                        q={sumQ} setQ={setSumQ}
                        onOpen={(id) => { openSpot(id); setFilter('done') }}
                        onExport={() => downloadCsv(buildCsv({ ...data, entries: merged }))}
                    />
                )}
                {view === 'pack' && (
                    <PackView
                        header={header('Quy cách đóng gói', 'Cấu hình thùng 6 / thùng 12')}
                        errorNote={errorNote}
                        wineItems={wineItems}
                        summary={summary}
                        q={packQ}
                        setQ={setPackQ}
                        filter={packFilter}
                        setFilter={setPackFilter}
                        onChangePackSize={async (code: string, packSize: number) => {
                            const res = await setShowroomItemPackSize({ code, packSize })
                            if (res.success) await refresh()
                            return res.success ? null : res.error
                        }}
                    />
                )}
            </div>
            {view !== 'count' && (
                <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-lys-border bg-lys-surface pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto flex max-w-xl">
                        {(['spots', 'sum', 'pack'] as const).map(v => (
                            <button key={v} onClick={() => { setView(v); window.scrollTo(0, 0) }}
                                className={`flex-1 border-t-[3px] py-3 text-sm font-semibold ${view === v ? 'border-lys-teal-strong text-lys-teal-strong' : 'border-transparent text-lys-muted'}`}>
                                {v === 'spots' ? 'Vị trí' : v === 'sum' ? 'Tổng hợp' : 'Quy cách'}
                            </button>
                        ))}
                    </div>
                </nav>
            )}
        </div>
    )
}

function mergedEntries(entries: ShowroomEntry[], overrides: Map<string, OverrideValue>, who: string): ShowroomEntry[] {
    if (!overrides.size) return entries
    // Overrides are this person's unsaved numbers; other people's rows stay untouched.
    const map = new Map(entries.map(e => [`${k(e.spotId, e.itemId)}|${e.countedBy}`, e]))
    for (const [key, ov] of overrides) {
        const [spotId, itemId] = key.split('|')
        const mine = `${key}|${who}`
        if (ov.qty === null) map.delete(mine)
        else map.set(mine, {
            spotId,
            itemId,
            qty: ov.qty,
            cases: ov.cases ?? map.get(mine)?.cases ?? null,
            loose: ov.loose ?? map.get(mine)?.loose ?? null,
            countedBy: who,
            countedAt: map.get(mine)?.countedAt ?? new Date().toISOString(),
        })
    }
    return [...map.values()]
}

function downloadCsv(csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kiem-ke-showroom-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ───────────────────────── Screens ─────────────────────────

function Welcome({ previous, onDone }: { previous: string; onDone: (name: string) => void }) {
    const [name, setName] = useState(previous)
    const [err, setErr] = useState('')
    const go = () => { const n = cleanLabel(name); if (!n) { setErr('Nhập tên của bạn (tối đa 60 ký tự).'); return } onDone(n) }
    return (
        <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 bg-lys-bg px-4 text-lys-primary">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">LY&apos;s Cellars · Showroom</div>
                <h1 className="mt-1 text-3xl font-extrabold">Kiểm kê rượu</h1>
            </div>
            <p className="text-sm text-lys-secondary">Nhập tên của bạn để mọi người biết ai đã đếm vị trí nào.</p>
            <label htmlFor="who" className="text-sm text-lys-muted">Tên người kiểm</label>
            <input id="who" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
                placeholder="Ví dụ: Lan" className="rounded-lg border border-lys-border bg-lys-surface px-4 py-3 text-base" />
            {err && <p className="text-sm text-tone-danger-fg">{err}</p>}
            <button onClick={go} className="rounded-lg bg-lys-teal-strong py-3.5 font-semibold text-white">Bắt đầu kiểm</button>
        </div>
    )
}

function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-lys-dim" />
            <input id={id} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
                className="w-full rounded-lg border border-lys-border bg-lys-surface py-3 pl-9 pr-3 text-base" />
        </label>
    )
}

function Vintage({ v }: { v: string }) {
    return v
        ? <span className="rounded bg-tone-brand-bg px-1.5 py-0.5 text-[13px] font-bold text-tone-brand-fg">{v}</span>
        : <span className="rounded border border-dashed border-lys-border px-1.5 py-0.5 text-[13px] text-lys-muted">NV</span>
}

function Code({ c }: { c: string }) {
    return <span className="text-[14px] font-extrabold tracking-wide text-lys-primary">{c}</span>
}

function PackBadge({ packSize }: { packSize: number }) {
    const cls = packSize === 12
        ? 'rounded border border-lys-teal-strong bg-tone-brand-bg px-1.5 py-0.5 text-[12px] font-bold text-lys-teal-strong'
        : 'rounded border border-lys-border bg-lys-bg px-1.5 py-0.5 text-[12px] font-semibold text-lys-secondary'
    return <span className={cls}>Thùng {packSize}</span>
}

type Summary = ReturnType<typeof summarize>

function SpotsView(props: {
    header: React.ReactNode; errorNote: React.ReactNode
    groups: Array<{ name: string; kind: string; spots: ShowroomSpot[] }>
    summary: Summary; homeQ: string; setHomeQ: (v: string) => void
    items: ShowroomItem[]; entries: ShowroomEntry[]; spotById: Map<string, ShowroomSpot>
    onOpen: (id: string, search?: string) => void; onSummary: () => void; onRenamed: () => Promise<void>
}) {
    const { summary, groups } = props
    const [editing, setEditing] = useState<Map<string, string> | null>(null)
    const [msg, setMsg] = useState('')
    const touched = summary.spots.filter(s => s.touched).length
    const hits = useMemo(() => {
        const q = normalizeSearch(props.homeQ.trim())
        if (!q) return []
        return props.items.filter(i => normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)).slice(0, 40)
    }, [props.homeQ, props.items])

    const save = async () => {
        if (!editing) return
        const res = await renameShowroomSpots([...editing].map(([id, name]) => ({ id, name })))
        if (!res.success) { setMsg(res.error); return }
        setMsg(''); setEditing(null); await props.onRenamed()
    }

    return (
        <div className="space-y-4">
            {props.header}
            {props.errorNote}
            {!editing && (
                <>
                    <button onClick={props.onSummary} className="flex w-full items-center justify-between gap-3 rounded-xl bg-lys-teal-strong px-4 py-3 text-left text-white">
                        <div>
                            <div className="text-xs opacity-85">Tổng đã đếm</div>
                            <div className="text-[15px]">
                                <b className="text-[26px] font-bold leading-tight">{fmt(summary.bottles)}</b> chai
                                {summary.posmTotal ? ` · ${fmt(summary.posmTotal)} POSM` : ''}
                            </div>
                            {summary.t2Bottles > 0 && (
                                <div className="mt-0.5 text-xs opacity-90">
                                    Tầng 2: {fmt(summary.t2Cases)} thùng + {fmt(summary.t2Loose)} chai lẻ = {fmt(summary.t2Bottles)} chai
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[13px]">
                            <span>{touched}/{summary.spots.length} vị trí</span>
                            <span className="font-bold">Xem tổng hợp ›</span>
                        </div>
                    </button>
                    <SearchBox id="homeSearch" value={props.homeQ} onChange={props.setHomeQ} placeholder="Tìm tên hoặc mã (vd: L20019, Chablis)…" />
                </>
            )}
            {props.homeQ.trim() && !editing ? (
                <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                    {!hits.length && <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">Không tìm thấy</b>Thử gõ một phần tên hoặc mã, ví dụ “1er Cru” hoặc “L200”.</p>}
                    {hits.map(item => {
                        const where = props.entries.filter(e => e.itemId === item.id)
                        const total = where.reduce((t, e) => t + e.qty, 0)
                        const pack = packSizeOf(item)
                        return (
                            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-lys-border p-3 first:border-t-0">
                                <div>
                                    <div className="text-sm font-medium leading-snug">{item.name}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lys-muted">
                                        {item.kind === 'POSM' ? 'POSM' : <><Vintage v={item.vintage} /><Code c={item.code} />{pack && <PackBadge packSize={pack} />}</>}
                                    </div>
                                </div>
                                <div className={`self-center text-[21px] font-bold ${where.length ? '' : 'text-lys-dim'}`}>{where.length ? fmt(total) : '–'}</div>
                                <div className="col-span-2 mt-1 flex flex-wrap gap-1.5">
                                    {where.length
                                        ? where.map(e => {
                                            const sp = props.spotById.get(e.spotId)
                                            const t2 = isCaseSpot(sp)
                                            const cl = t2 && pack ? entryCaseLoose(e, pack) : null
                                            return (
                                                <button key={`${e.spotId}|${e.countedBy}`} onClick={() => { props.setHomeQ(''); props.onOpen(e.spotId, item.code) }}
                                                    className="rounded-full border border-lys-border bg-lys-bg px-2.5 py-1 text-[13px]">
                                                    {sp?.name ?? e.spotId}:{' '}
                                                    {cl ? (
                                                        <b className="text-lys-teal-strong">{cl.cases}T + {cl.loose} lẻ = {e.qty}</b>
                                                    ) : (
                                                        <b className="text-lys-teal-strong">{e.qty}</b>
                                                    )}
                                                    <span className="text-lys-muted"> · {e.countedBy}</span>
                                                </button>
                                            )
                                        })
                                        : <span className="text-sm text-lys-muted">Chưa đếm ở vị trí nào</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <>
                    {groups.map(g => {
                        const isT2Group = g.name === 'Tầng 2'
                        return (
                            <section key={g.name} className="space-y-2">
                                <div className="flex items-baseline justify-between gap-2">
                                    <h2 className="text-[15px] font-bold uppercase tracking-wide text-lys-muted">{g.name}</h2>
                                    {isT2Group && summary.t2Bottles > 0 && (
                                        <span className="text-xs font-semibold text-lys-teal-strong">
                                            {fmt(summary.t2Cases)} thùng · {fmt(summary.t2Loose)} lẻ · Tổng {fmt(summary.t2Bottles)} chai
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {g.spots.map(s => {
                                        const ss = summary.spots.find(x => x.spot.id === s.id)
                                        const [u1, u2] = unitOf(s)
                                        const t2 = isCaseSpot(s)
                                        if (editing) return (
                                            <div key={s.id} className="flex flex-col gap-1.5 rounded-xl border border-lys-border bg-lys-surface p-3">
                                                <span className="text-xs text-lys-muted">{g.name}</span>
                                                <input aria-label="Tên vị trí" value={editing.get(s.id) ?? s.name}
                                                    onChange={e => setEditing(m => new Map(m!).set(s.id, e.target.value))}
                                                    className="rounded-md border border-lys-border px-2 py-1.5 text-[15px]" />
                                            </div>
                                        )
                                        return (
                                            <button key={s.id} onClick={() => props.onOpen(s.id)}
                                                className={`flex min-h-[84px] flex-col gap-1.5 rounded-xl border bg-lys-surface p-3 text-left ${ss?.touched ? 'border-tone-success-fg' : 'border-lys-border'}`}>
                                                <span className="font-semibold leading-tight">{s.name}</span>
                                                <span className={`mt-auto text-[13px] font-semibold ${ss?.touched ? 'text-tone-success-fg' : 'text-lys-muted'}`}>
                                                    {ss?.touched
                                                        ? t2
                                                            ? `${ss.lines} ${u1} · ${fmt(ss.cases)} thùng + ${fmt(ss.loose)} lẻ · Tổng ${fmt(ss.qty)} ${u2}`
                                                            : `${ss.lines} ${u1} · ${fmt(ss.qty)} ${u2}`
                                                        : 'Chưa đếm'}
                                                    {ss?.cells ? <span className="block font-medium text-lys-muted">✓ kiểm lại {ss.rechecked}/{ss.cells}</span> : null}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )
                    })}
                    {editing ? (
                        <div className="space-y-2">
                            <button onClick={save} className="w-full rounded-lg bg-lys-teal-strong py-3 font-semibold text-white">Lưu tên vị trí</button>
                            <button onClick={() => { setEditing(null); setMsg('') }} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Hủy</button>
                        </div>
                    ) : (
                        <button onClick={() => setEditing(new Map())} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Đổi tên vị trí</button>
                    )}
                    {msg && <p className="text-sm text-tone-danger-fg">{msg}</p>}
                </>
            )}
        </div>
    )
}

function CountView(props: {
    spot: ShowroomSpot; items: ShowroomItem[]; allWine: ShowroomItem[]
    q: string; setQ: (v: string) => void; filter: CountFilter; setFilter: (f: CountFilter) => void
    qtyOf: (spotId: string, itemId: string) => number | null
    setQty: (spotId: string, itemId: string, qty: number | null, delay?: number) => void
    caseLooseOf: (spotId: string, item: ShowroomItem) => { cases: number | null; loose: number | null; qty: number | null }
    setCaseLoose: (spotId: string, item: ShowroomItem, cases: number | null, loose: number | null, delay?: number) => void
    entryOf: (itemId: string) => ShowroomEntry | undefined
    othersOf: (itemId: string) => ShowroomEntry[]
    checkOf: (itemId: string) => ShowroomCheck | undefined
    onRecheck: (itemId: string, checked: boolean) => Promise<string | null>
    notesOf: (itemId: string) => ShowroomNote[]
    onSaveNote: (itemId: string, note: string) => Promise<string | null>
    saving: Set<string>; errors: Map<string, string>
    spotSummary?: { lines: number; qty: number; cases: number; loose: number; cells: number; rechecked: number }
    errorNote: React.ReactNode; who: string
    onBack: () => void; onAdded: (code: string) => Promise<void>
}) {
    const { spot } = props
    const posm = spot.kind === 'POSM'
    const t2 = isCaseSpot(spot)
    const [u1, u2] = unitOf(spot)
    const [addCode, setAddCode] = useState<string | null>(null)
    const [inlineFor, setInlineFor] = useState<string | null>(null)
    const [recheckMsg, setRecheckMsg] = useState<Map<string, string>>(new Map())
    const [rechecking, setRechecking] = useState<string | null>(null)
    // Rows whose note editor is open; a draft left from before a reload reopens its editor.
    const [noteOpen, setNoteOpen] = useState<Set<string>>(() => {
        const open = new Set<string>()
        try {
            const prefix = `${NOTE_DRAFT}${props.who}|${spot.id}|`
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key?.startsWith(prefix)) open.add(key.slice(prefix.length))
            }
        } catch { /* storage unavailable */ }
        return open
    })
    const toggleNote = (itemId: string, open: boolean) => setNoteOpen(o => { const n = new Set(o); if (open) n.add(itemId); else n.delete(itemId); return n })
    const noteButton = (itemId: string) => (
        <button onClick={() => toggleNote(itemId, !noteOpen.has(itemId))} aria-expanded={noteOpen.has(itemId)}
            className="py-1 font-semibold text-lys-teal-strong">
            {props.notesOf(itemId).some(x => x.writtenBy === props.who) ? 'Sửa ghi chú' : '+ Ghi chú'}
        </button>
    )
    const noteEditor = (itemId: string, placeholder?: string) => noteOpen.has(itemId) && (
        <div className="col-span-2">
            <NoteEditor draftKey={`${NOTE_DRAFT}${props.who}|${spot.id}|${itemId}`} placeholder={placeholder}
                saved={props.notesOf(itemId).find(x => x.writtenBy === props.who)?.note ?? ''}
                onSave={note => props.onSaveNote(itemId, note)} onClose={() => toggleNote(itemId, false)} />
        </div>
    )
    const shown = useMemo(() => {
        const q = normalizeSearch(props.q.trim())
        return props.items.filter(i => {
            const n = props.qtyOf(spot.id, i.id)
            const others = props.othersOf(i.id)
            const counted = n !== null || others.length > 0
            const any = (n !== null && n > 0) || others.some(e => e.qty > 0)
            if (props.filter === 'done' && !any) return false
            if (props.filter === 'todo' && counted) return false
            if (props.filter === 'recheck') {
                const total = (n ?? 0) + others.reduce((t, e) => t + e.qty, 0)
                if (!counted || checkState(total, props.checkOf(i.id)) === 'ok') return false
            }
            return !q || normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.items, props.q, props.filter, props.qtyOf, props.othersOf, props.checkOf, spot.id])

    const recheck = async (itemId: string, checked: boolean) => {
        setRechecking(itemId)
        const err = await props.onRecheck(itemId, checked)
        setRechecking(null)
        setRecheckMsg(m => { const n = new Map(m); if (err) n.set(itemId, err); else n.delete(itemId); return n })
    }

    return (
        <div className="space-y-3">
            <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-lys-bg px-4 py-2">
                <button onClick={props.onBack} className="flex items-center gap-1 py-1 font-semibold text-lys-teal-strong"><ChevronLeft className="size-4" />Các vị trí</button>
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-lys-muted">
                        {spot.groupName}
                        {props.spotSummary?.lines
                            ? t2
                                ? ` · ${props.spotSummary.lines} ${u1} · ${fmt(props.spotSummary.cases)} thùng + ${fmt(props.spotSummary.loose)} lẻ · Tổng ${fmt(props.spotSummary.qty)} ${u2}`
                                : ` · ${props.spotSummary.lines} ${u1} · ${fmt(props.spotSummary.qty)} ${u2}`
                            : ''}
                        {props.spotSummary?.cells ? ` · kiểm lại ${props.spotSummary.rechecked}/${props.spotSummary.cells}` : ''}
                    </div>
                    <h1 className="mt-1 text-2xl font-extrabold">{spot.name}</h1>
                </div>
                {t2 && (
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-lys-border bg-lys-surface px-3 py-2 text-center">
                        <div>
                            <div className="text-[11px] font-semibold uppercase text-lys-muted">Số thùng</div>
                            <div className="text-lg font-extrabold text-lys-primary">{fmt(props.spotSummary?.cases ?? 0)}</div>
                        </div>
                        <div className="border-x border-lys-border">
                            <div className="text-[11px] font-semibold uppercase text-lys-muted">Chai lẻ</div>
                            <div className="text-lg font-extrabold text-lys-primary">{fmt(props.spotSummary?.loose ?? 0)}</div>
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold uppercase text-lys-muted">Tổng chai</div>
                            <div className="text-lg font-extrabold text-lys-teal-strong">{fmt(props.spotSummary?.qty ?? 0)}</div>
                        </div>
                    </div>
                )}
                <SearchBox id="search" value={props.q} onChange={props.setQ} placeholder={posm ? 'Tìm vật phẩm…' : 'Tìm tên rượu, mã, vintage…'} />
                <div role="group" aria-label="Lọc" className="grid grid-cols-4 gap-1 rounded-lg border border-lys-border bg-lys-surface p-1">
                    {([['all', 'Tất cả'], ['done', 'Có số'], ['todo', 'Chưa đếm'], ['recheck', 'Chưa kiểm lại']] as const).map(([v, l]) => (
                        <button key={v} aria-pressed={props.filter === v} onClick={() => props.setFilter(v)}
                            className={`rounded-md px-1 py-2 text-[13px] leading-tight ${props.filter === v ? 'bg-lys-teal-strong font-semibold text-white' : 'text-lys-muted'}`}>{l}</button>
                    ))}
                </div>
            </div>
            {props.errorNote}
            <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                {!shown.length && <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{posm ? 'Không thấy vật phẩm nào' : 'Không thấy rượu nào'}</b>{posm ? 'Thử từ khóa khác.' : 'Thử từ khóa khác, hoặc thêm vintage chưa có ở bên dưới.'}</p>}
                {shown.map(item => {
                    const key = `${spot.id}|${item.id}`
                    const n = props.qtyOf(spot.id, item.id)
                    const pack = packSizeOf(item) ?? 6
                    const cl = t2 ? props.caseLooseOf(spot.id, item) : null
                    const entry = props.entryOf(item.id)
                    const err = props.errors.get(key)
                    const stamp = err ?? (props.saving.has(key) ? 'Đang lưu…' : entry ? `Bạn (${entry.countedBy}) · ${when(entry.countedAt)}` : '')
                    // Other people's own numbers for this spot: they add up, nobody overwrites anybody.
                    const others = props.othersOf(item.id)
                    const total = (n ?? 0) + others.reduce((t, e) => t + e.qty, 0)
                    const othersCl = t2 ? others.map(e => ({ by: e.countedBy, ...entryCaseLoose(e, pack) })) : []
                    const totalCases = t2 ? (cl?.cases ?? 0) + othersCl.reduce((t, x) => t + x.cases, 0) : 0
                    const totalLoose = t2 ? (cl?.loose ?? 0) + othersCl.reduce((t, x) => t + x.loose, 0) : 0

                    return (
                        <div key={item.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-lys-border p-3 first:border-t-0 ${total > 0 ? 'bg-tone-success-bg' : ''}`}>
                            <div className={t2 ? 'col-span-2' : ''}>
                                <div className="text-sm font-medium leading-snug">{item.name}</div>
                                {!posm && (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lys-muted">
                                        <Vintage v={item.vintage} /><Code c={item.code} />
                                        {t2 && <PackBadge packSize={pack} />}
                                        {item.isExtra && <span>thêm tay</span>}
                                        <button onClick={() => setInlineFor(f => f === item.id ? null : item.id)} aria-expanded={inlineFor === item.id}
                                            className="py-1 font-semibold text-lys-teal-strong">+ vintage khác</button>
                                        {noteButton(item.id)}
                                    </div>
                                )}
                                {posm && <div className="mt-1 text-xs">{noteButton(item.id)}</div>}
                            </div>

                            {t2 && cl ? (
                                <div className="col-span-2">
                                    <CaseLooseStepper
                                        cases={cl.cases}
                                        loose={cl.loose}
                                        total={cl.qty}
                                        packSize={pack}
                                        itemLabel={`${item.name} ${item.vintage}`}
                                        onChange={(nextCases, nextLoose, delay) => props.setCaseLoose(spot.id, item, nextCases, nextLoose, delay)}
                                    />
                                </div>
                            ) : (
                                <Stepper value={n} label={`Số lượng ${item.name} ${item.vintage}`} onChange={(v, delay) => props.setQty(spot.id, item.id, v, delay)} />
                            )}

                            {inlineFor === item.id && (
                                <div className="col-span-2">
                                    <AddVintage inline spot={spot} wines={props.allWine} code={item.code}
                                        setCode={c => { if (c === null) setInlineFor(null) }} who={props.who} onAdded={props.onAdded} />
                                </div>
                            )}
                            {stamp && <div className={`col-span-2 text-xs ${err ? 'text-tone-danger-fg' : 'text-lys-muted'}`}>{stamp}</div>}
                            <Notes notes={props.notesOf(item.id)} who={props.who} editing={noteOpen.has(item.id)} />
                            {noteEditor(item.id)}
                            {others.length > 0 && (
                                <div className="col-span-2 rounded-md bg-tone-warning-bg px-2 py-1 text-xs text-tone-warning-fg">
                                    {t2 ? (
                                        <>
                                            Người khác đã đếm ở đây:{' '}
                                            {othersCl.map(e => `${e.by}: ${e.cases} thùng + ${e.loose} lẻ (${e.qty} chai)`).join(' · ')}{' '}
                                            — Tổng vị trí: <b>{totalCases} thùng + {totalLoose} lẻ = {total} chai</b>
                                        </>
                                    ) : (
                                        <>
                                            Người khác đã đếm ở đây: {others.map(e => `${e.countedBy} ${e.qty}`).join(' · ')} — tổng vị trí <b>{total}</b>
                                        </>
                                    )}
                                </div>
                            )}
                            {(n !== null || others.length > 0) && (
                                <Recheck
                                    check={props.checkOf(item.id)}
                                    total={total}
                                    canCheck={canRecheck([...(n !== null ? [props.who] : []), ...others.map(e => e.countedBy)], props.who)}
                                    busy={rechecking === item.id}
                                    error={recheckMsg.get(item.id)}
                                    onChange={checked => recheck(item.id, checked)}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-lys-border bg-lys-surface p-3">
                <b className="text-sm">Ghi chú chung cho vị trí này</b>
                <div className="text-xs">{noteButton('')}</div>
                <Notes notes={props.notesOf('')} who={props.who} editing={noteOpen.has('')} />
                {noteEditor('', 'Ví dụ: còn 2 thùng chưa mở ở góc kệ')}
            </div>
            {!posm && <AddVintage spot={spot} wines={props.allWine} code={addCode} setCode={setAddCode} who={props.who} onAdded={props.onAdded} />}
            <p className="text-sm text-lys-muted">
                {t2
                    ? 'Nhập số thùng và số chai lẻ thực tế (giữ nguyên số chai lẻ, hệ thống tự cộng tổng chai). Quy cách đóng gói được cấu hình riêng ở tab "Quy cách".'
                    : `Số tự lưu sau khi bạn ngừng gõ. Để trống nghĩa là chưa đếm; nhập 0 nghĩa là đã kiểm và không có ${u2} nào.`}
            </p>
        </div>
    )
}

/** Cụm nhập Số thùng + Số chai lẻ + Tổng chai (chỉ bật cho Tầng 2). Giữ nguyên số chai lẻ người dùng nhập. */
function CaseLooseStepper({
    cases,
    loose,
    total,
    packSize,
    itemLabel,
    onChange,
}: {
    cases: number | null
    loose: number | null
    total: number | null
    packSize: number
    itemLabel: string
    onChange: (cases: number | null, loose: number | null, delay?: number) => void
}) {
    const stepCases = (delta: number) => {
        const next = delta < 0
            ? (cases === null ? null : cases <= 0 ? null : cases - 1)
            : (cases ?? 0) + 1
        onChange(next, loose, 600)
    }
    const stepLoose = (delta: number) => {
        const next = delta < 0
            ? (loose === null ? null : loose <= 0 ? null : loose - 1)
            : (loose ?? 0) + 1
        onChange(cases, next, 600)
    }
    return (
        <div className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2 rounded-lg border border-lys-border bg-lys-bg p-2">
            <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-lys-muted">Số thùng (×{packSize})</span>
                <div className="flex items-center overflow-hidden rounded-lg border border-lys-border bg-lys-surface">
                    <button type="button" aria-label={`Bớt 1 thùng ${itemLabel}`} onClick={() => stepCases(-1)}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-lys-teal-strong"><Minus className="size-4" /></button>
                    <input inputMode="numeric" aria-label={`Số thùng ${itemLabel}`} placeholder="0" value={cases ?? ''} onFocus={e => e.target.select()}
                        onChange={e => {
                            const t = e.target.value.replace(/\D/g, '').slice(0, 5)
                            onChange(t === '' ? null : parseInt(t, 10), loose)
                        }}
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-center text-[18px] font-bold" />
                    <button type="button" aria-label={`Thêm 1 thùng ${itemLabel}`} onClick={() => stepCases(1)}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-lys-teal-strong"><Plus className="size-4" /></button>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-lys-muted">Chai lẻ</span>
                <div className="flex items-center overflow-hidden rounded-lg border border-lys-border bg-lys-surface">
                    <button type="button" aria-label={`Bớt 1 chai lẻ ${itemLabel}`} onClick={() => stepLoose(-1)}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-lys-teal-strong"><Minus className="size-4" /></button>
                    <input inputMode="numeric" aria-label={`Số chai lẻ ${itemLabel}`} placeholder="0" value={loose ?? ''} onFocus={e => e.target.select()}
                        onChange={e => {
                            const t = e.target.value.replace(/\D/g, '').slice(0, 5)
                            onChange(cases, t === '' ? null : parseInt(t, 10))
                        }}
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-center text-[18px] font-bold" />
                    <button type="button" aria-label={`Thêm 1 chai lẻ ${itemLabel}`} onClick={() => stepLoose(1)}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-lys-teal-strong"><Plus className="size-4" /></button>
                </div>
            </div>

            <div className="flex min-w-[78px] flex-col items-end justify-between rounded-lg border border-lys-border bg-lys-surface px-2.5 py-1.5 text-right">
                <span className="text-[11px] font-semibold text-lys-muted">Tổng chai</span>
                <div className={`text-[20px] font-extrabold leading-none ${total !== null ? 'text-lys-teal-strong' : 'text-lys-dim'}`}>
                    {total !== null ? fmt(total) : '–'}
                </div>
                <span className="text-[10px] text-lys-muted">
                    {total !== null ? `${cases ?? 0}T + ${loose ?? 0} lẻ` : 'chưa đếm'}
                </span>
            </div>
        </div>
    )
}

/** Dấu kiểm lần 2: người khác người đếm tích "đúng"; nếu số bị sửa sau đó thì dấu tự mất hiệu lực. */
function Recheck({ check, total, canCheck, busy, error, onChange }: {
    check?: ShowroomCheck; total: number; canCheck: boolean; busy: boolean; error?: string; onChange: (checked: boolean) => void
}) {
    const state = checkState(total, check)
    return (
        <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {state === 'ok' ? (
                <>
                    <span className="rounded-md bg-tone-success-fg px-2 py-1 font-semibold text-white">✓ Đã kiểm lại · {check!.checkedBy} · {when(check!.checkedAt)}</span>
                    <button disabled={busy} onClick={() => onChange(false)} className="py-1 font-semibold text-lys-muted underline disabled:opacity-50">Bỏ tích</button>
                </>
            ) : (
                <>
                    {state === 'changed' && (
                        <span className="text-tone-warning-fg">Số đã đổi sau khi {check!.checkedBy} kiểm lại (lúc đó {check!.qtyAtCheck}).</span>
                    )}
                    {canCheck ? (
                        <button disabled={busy} onClick={() => onChange(true)}
                            className="rounded-md border border-tone-success-fg px-2.5 py-1.5 font-semibold text-tone-success-fg disabled:opacity-50">
                            ☐ Kiểm lại: đúng {total}
                        </button>
                    ) : (
                        <span className="text-lys-muted">Cần người khác kiểm lại dòng này</span>
                    )}
                </>
            )}
            {error && <span className="w-full text-tone-danger-fg">{error}</span>}
        </div>
    )
}

/** Ghi chú đã lưu của mọi người cho một dòng; ghi chú của mình ẩn khi đang sửa. */
function Notes({ notes, who, editing }: { notes: ShowroomNote[]; who: string; editing: boolean }) {
    const shown = notes.filter(n => !(editing && n.writtenBy === who))
    if (!shown.length) return null
    return (
        <div className="col-span-2 space-y-1">
            {shown.map(n => (
                <div key={n.writtenBy} className="whitespace-pre-wrap break-words rounded-md border-l-[3px] border-lys-teal-strong bg-lys-bg px-2 py-1 text-[13px]">
                    <span className="font-semibold">{n.writtenBy === who ? 'Bạn' : n.writtenBy}:</span> {n.note}
                    <span className="text-xs text-lys-muted"> · {when(n.updatedAt)}</span>
                </div>
            ))}
        </div>
    )
}

/** Ô ghi chú: bản đang gõ nằm trong localStorage tới khi lưu xong, nên reload không mất. Lưu rỗng = xoá ghi chú. */
function NoteEditor({ draftKey, saved, onSave, onClose, placeholder = 'Ví dụ: hộp rách, nhãn bẩn, để lẫn vị trí khác…' }: {
    draftKey: string; saved: string; onSave: (note: string) => Promise<string | null>; onClose: () => void; placeholder?: string
}) {
    const [text, setText] = useState(() => { try { return localStorage.getItem(draftKey) ?? saved } catch { return saved } })
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState('')
    const keepDraft = (v: string) => { try { if (v === saved) localStorage.removeItem(draftKey); else localStorage.setItem(draftKey, v) } catch { /* private mode */ } }
    const close = () => { try { localStorage.removeItem(draftKey) } catch { /* private mode */ } onClose() }
    const save = async (v: string) => {
        setBusy(true)
        const err = await onSave(v)
        setBusy(false)
        if (err) { setMsg(err); return }
        close()
    }
    return (
        <div className="space-y-2 rounded-lg border border-lys-teal-strong bg-tone-brand-bg p-2">
            <textarea autoFocus rows={2} maxLength={MAX_NOTE} value={text} placeholder={placeholder} aria-label="Ghi chú"
                onChange={e => { setText(e.target.value); keepDraft(e.target.value) }}
                className="w-full rounded-md border border-lys-border bg-lys-surface px-3 py-2 text-base" />
            <div className="flex gap-2">
                <button disabled={busy} onClick={() => save(text)} className="flex-1 rounded-lg bg-lys-teal-strong py-2.5 font-semibold text-white disabled:opacity-50">Lưu ghi chú</button>
                {saved && <button disabled={busy} onClick={() => save('')} className="rounded-lg border border-tone-danger-fg px-3 py-2.5 font-semibold text-tone-danger-fg disabled:opacity-50">Xoá</button>}
                <button disabled={busy} onClick={close} className="rounded-lg border border-lys-teal-strong px-3 py-2.5 font-semibold text-lys-teal-strong">Hủy</button>
            </div>
            {msg && <p className="text-sm text-tone-danger-fg">{msg}</p>}
        </div>
    )
}

function Stepper({ value, label, onChange }: { value: number | null; label: string; onChange: (v: number | null, delay?: number) => void }) {
    return (
        <div className="flex items-center overflow-hidden rounded-lg border border-lys-border bg-lys-surface">
            <button aria-label="Bớt 1" onClick={() => onChange(value === null ? null : value <= 0 ? null : value - 1, 600)}
                className="flex h-11 w-10 items-center justify-center text-lys-teal-strong"><Minus className="size-5" /></button>
            <input inputMode="numeric" aria-label={label} value={value ?? ''} onFocus={e => e.target.select()}
                onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 6); onChange(t === '' ? null : parseInt(t, 10)) }}
                className="w-14 bg-transparent py-2.5 text-center text-[21px] font-bold" />
            <button aria-label="Thêm 1" onClick={() => onChange((value ?? 0) + 1, 600)}
                className="flex h-11 w-10 items-center justify-center text-lys-teal-strong"><Plus className="size-5" /></button>
        </div>
    )
}

function AddVintage({ spot, wines, code, setCode, who, onAdded, inline = false }: {
    spot: ShowroomSpot; wines: ShowroomItem[]; code: string | null; setCode: (c: string | null) => void; who: string; onAdded: (code: string) => Promise<void>
    inline?: boolean // opened from a row: the wine is fixed, only the year is asked
}) {
    const codes = useMemo(() => [...new Map(wines.map(w => [w.code, w.name])).entries()], [wines])
    const [vin, setVin] = useState('')
    const [msg, setMsg] = useState('')
    const [busy, setBusy] = useState(false)
    if (code === null) return (
        <button onClick={() => setCode(codes[0]?.[0] ?? '')} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">+ Thêm vintage chưa có trong danh sách</button>
    )
    const add = async () => {
        if (normalizeVintage(vin) === null) { setMsg('Vintage là năm 4 chữ số, ví dụ 2021. Để trống nếu là NV.'); return }
        setBusy(true)
        const res = await addShowroomVintage({ code, vintage: vin, spotId: spot.id, countedBy: who })
        setBusy(false)
        if (!res.success) { setMsg(res.error); return }
        setMsg(''); setVin(''); setCode(null)
        await onAdded(code)
    }
    return (
        <div className={`space-y-2 rounded-xl border p-3 ${inline ? 'border-lys-teal-strong bg-tone-brand-bg' : 'border-lys-border bg-lys-surface'}`}>
            <b className="text-sm">{inline ? <>Thêm vintage khác cho <Code c={code} /></> : 'Thêm vintage khác'}</b>
            <div className="flex gap-2">
                {inline ? (
                    <span className="min-w-0 flex-1 self-center text-sm text-lys-secondary">{codes.find(([c]) => c === code)?.[1]}</span>
                ) : (
                    <select aria-label="Chọn rượu" value={code} onChange={e => setCode(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-lys-border bg-lys-surface p-2.5 text-sm">
                        {codes.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
                    </select>
                )}
                <input id={inline ? `addVin-${code}` : 'addVin'} autoFocus={inline} inputMode="numeric" maxLength={4} placeholder="Năm" aria-label="Vintage"
                    value={vin} onChange={e => setVin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && add()}
                    className="w-24 rounded-lg border border-lys-border bg-lys-surface px-3 py-2.5 text-base" />
            </div>
            <div className="flex gap-2">
                <button disabled={busy} onClick={add} className="flex-1 rounded-lg bg-lys-teal-strong py-3 font-semibold text-white disabled:opacity-50">Thêm vào vị trí này</button>
                <button onClick={() => { setCode(null); setMsg('') }} className="flex-1 rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Hủy</button>
            </div>
            {msg && <p className="text-sm text-tone-danger-fg">{msg}</p>}
        </div>
    )
}

function SummaryView(props: {
    header: React.ReactNode; errorNote: React.ReactNode; summary: Summary
    groups: Array<{ name: string; kind: string; spots: ShowroomSpot[] }>
    notes: ShowroomNote[]; items: ShowroomItem[]
    mode: SumMode; setMode: (m: SumMode) => void; q: string; setQ: (v: string) => void
    onOpen: (spotId: string) => void; onExport: () => void
}) {
    const { summary: s } = props
    const wineGroups = props.groups.filter(g => g.kind !== 'POSM')
    const groupTotal = (name: string) => s.wineFound.reduce((t, x) => t + (x.byGroup[name] ?? 0), 0)
    const q = normalizeSearch(props.q.trim())
    const hit = (i: ShowroomItem) => !q || normalizeSearch(`${i.name} ${i.code} ${i.vintage}`).includes(q)
    const modes: Array<[SumMode, string]> = [['wine', 'Theo rượu'], ['spot', 'Vị trí'], ['people', `Người kiểm (${s.people.length})`], ['missing', `Chưa thấy (${s.wineMissing.length})`]]
    if (s.posm.length) modes.push(['posm', 'POSM'])
    modes.push(['notes', `Ghi chú (${props.notes.length})`])
    const row = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-lys-border p-3 first:border-t-0'

    return (
        <div className="space-y-4">
            {props.header}
            {props.errorNote}
            <div className="grid grid-cols-2 gap-2">
                {[[fmt(s.bottles), 'chai đã đếm'], [String(s.wineFound.length), `/${s.wineCount} dòng có hàng`],
                  [`${s.spots.filter(x => x.touched).length}/${s.spots.length}`, 'vị trí đã kiểm'], [`${s.rechecked}/${s.cells}`, 'dòng đã kiểm lại (lần 2)']].map(([n, l]) => (
                    <div key={l} className="rounded-xl border border-lys-border bg-lys-surface px-3 py-2.5">
                        <div className="text-2xl font-bold">{n}</div><div className="text-xs text-lys-muted">{l}</div>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                {wineGroups.map(g => (
                    <div key={g.name} className="flex min-w-[90px] flex-1 flex-col justify-between gap-0.5 rounded-lg bg-tone-brand-bg px-3 py-2 text-[13px] font-semibold text-tone-brand-fg">
                        <div className="flex items-baseline justify-between gap-2">
                            <span>{g.name}</span><b className="text-lg">{fmt(groupTotal(g.name))}</b>
                        </div>
                        {g.name === 'Tầng 2' && (
                            <div className="text-[11px] font-medium opacity-85">
                                {fmt(s.t2Cases)} thùng + {fmt(s.t2Loose)} chai lẻ
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div role="group" aria-label="Kiểu tổng hợp" className="grid grid-cols-3 gap-1 rounded-lg border border-lys-border bg-lys-surface p-1">
                {modes.map(([v, l]) => (
                    <button key={v} aria-pressed={props.mode === v} onClick={() => props.setMode(v)}
                        className={`rounded-md px-1 py-2 text-sm ${props.mode === v ? 'bg-lys-teal-strong font-semibold text-white' : 'text-lys-muted'}`}>{l}</button>
                ))}
            </div>
            {props.mode !== 'spot' && <SearchBox id="sumSearch" value={props.q} onChange={props.setQ}
                placeholder={props.mode === 'posm' ? 'Tìm vật phẩm…' : props.mode === 'people' ? 'Tìm người kiểm, rượu, mã…' : props.mode === 'notes' ? 'Tìm ghi chú, người ghi, rượu…' : 'Tìm tên rượu, mã, vintage…'} />}

            <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                {props.mode === 'wine' && (() => {
                    const list = s.wineFound.filter(x => hit(x.item))
                    if (!list.length) return <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{q ? 'Không có dòng nào khớp' : 'Chưa có số nào'}</b>{q ? '' : 'Chọn một vị trí ở tab Vị trí để bắt đầu đếm.'}</p>
                    return list.map(x => {
                        const pack = packSizeOf(x.item)
                        return (
                            <details key={x.item.id} className="border-t border-lys-border p-3 first:border-t-0">
                                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                                    <div>
                                        <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lys-muted">
                                            <Vintage v={x.item.vintage} /><Code c={x.item.code} />
                                            {pack && <PackBadge packSize={pack} />}
                                        </div>
                                        <div className="mt-1 text-xs text-lys-muted">
                                            {Object.entries(x.byGroup).map(([g, n]) =>
                                                g === 'Tầng 2' ? `${g}: ${x.t2Cases} thùng + ${x.t2Loose} lẻ = ${n}` : `${g}: ${n}`
                                            ).join(' · ')}
                                        </div>
                                    </div>
                                    <div className="self-center text-[21px] font-bold">{fmt(x.total)}</div>
                                </summary>
                                <div className="mt-2 space-y-1 rounded-lg bg-lys-bg px-3 py-2 text-[13px]">
                                    {x.parts.map(p => (
                                        <div key={`${p.spot.id}|${p.by}`} className="flex justify-between gap-3">
                                            <span>{p.spot.name} <span className="text-lys-muted">· {p.by}</span></span>
                                            <b>{p.cases != null ? `${p.cases} thùng + ${p.loose ?? 0} lẻ = ${p.qty}` : p.qty}</b>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )
                    })
                })()}
                {props.mode === 'people' && (() => {
                    // Who counted what, so each person's numbers can be re-checked.
                    const list = s.people
                        .map(p => normalizeSearch(p.name).includes(q) ? p : { ...p, lines: p.lines.filter(l => hit(l.item)) })
                        .filter(p => !q || p.lines.length)
                    if (!list.length) return <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{q ? 'Không có dòng nào khớp' : 'Chưa ai đếm'}</b></p>
                    return list.map(p => (
                        <details key={p.name} className="border-t border-lys-border p-3 first:border-t-0">
                            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="mt-1 text-xs text-lys-muted">
                                        {p.lines.length} dòng{p.rechecks ? ` · đã kiểm lại ${p.rechecks} dòng của người khác` : ''} · {[...new Set(p.lines.map(l => l.spot.name))].join(', ')}
                                    </div>
                                </div>
                                <div className="self-center text-right">
                                    <div className="text-[21px] font-bold">{fmt(p.wine)}</div>
                                    <div className="text-xs text-lys-muted">chai{p.posm ? ` · ${fmt(p.posm)} POSM` : ''}</div>
                                </div>
                            </summary>
                            <div className="mt-2 divide-y divide-lys-border rounded-lg bg-lys-bg px-3 text-[13px]">
                                {p.lines.map(l => (
                                    <div key={`${l.spot.id}|${l.item.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
                                        <div>
                                            <div className="text-xs text-lys-muted">{l.spot.name} · {when(l.at)}</div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                {l.item.kind !== 'POSM' && <><Code c={l.item.code} /><Vintage v={l.item.vintage} /></>}
                                                <span>{l.item.name}</span>
                                            </div>
                                        </div>
                                        <div className="self-center text-right">
                                            <b className="text-base">{l.qty}</b>
                                            {l.cases != null && (
                                                <div className="text-[11px] text-lys-muted">{l.cases}T + {l.loose ?? 0} lẻ</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ))
                })()}
                {props.mode === 'missing' && (() => {
                    const list = s.wineMissing.filter(x => hit(x.item))
                    if (!list.length) return <p className="p-6 text-center font-bold">{q ? 'Không có dòng nào khớp' : 'Dòng nào cũng đã thấy hàng'}</p>
                    return list.map(x => {
                        const pack = packSizeOf(x.item)
                        return (
                            <div key={x.item.id} className={row}>
                                <div>
                                    <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-lys-muted">
                                        <Vintage v={x.item.vintage} /><Code c={x.item.code} />
                                        {pack && <PackBadge packSize={pack} />}
                                    </div>
                                </div>
                                <span className="self-center whitespace-nowrap rounded-md border border-lys-border px-2 py-1 text-xs text-lys-muted">{x.checked ? 'Đã kiểm = 0' : 'Chưa đếm'}</span>
                            </div>
                        )
                    })
                })()}
                {props.mode === 'posm' && (
                    <>
                        <div className="flex justify-between bg-tone-brand-bg px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-tone-brand-fg"><span>POSM</span><b className="normal-case">{fmt(s.posmTotal)} cái</b></div>
                        {s.posm.filter(x => hit(x.item)).map(x => (
                            <div key={x.item.id} className={row}>
                                <div>
                                    <div className="text-sm font-medium leading-snug">{x.item.name}</div>
                                    <div className="mt-1 text-xs text-lys-muted">{x.total ? x.parts.map(p => `${p.spot.name}: ${p.qty} (${p.by})`).join(' · ') : x.checked ? 'Đã kiểm = 0' : 'Chưa đếm'}</div>
                                </div>
                                <div className={`self-center text-[21px] font-bold ${x.checked ? '' : 'text-lys-dim'}`}>{x.checked ? fmt(x.total) : '–'}</div>
                            </div>
                        ))}
                    </>
                )}
                {props.mode === 'notes' && (() => {
                    const itemById = new Map(props.items.map(i => [i.id, i]))
                    const list = props.groups.flatMap(g => g.spots)
                        .flatMap(spot => props.notes.filter(n => n.spotId === spot.id).map(n => ({ n, spot, item: itemById.get(n.itemId) })))
                        .filter(({ n, item }) => !q || normalizeSearch(`${n.note} ${n.writtenBy} ${item ? `${item.name} ${item.code} ${item.vintage}` : ''}`).includes(q))
                    if (!list.length) return <p className="p-6 text-center text-lys-muted"><b className="block text-lys-primary">{q ? 'Không có ghi chú nào khớp' : 'Chưa có ghi chú'}</b>{q ? '' : 'Bấm “+ Ghi chú” ở từng dòng khi đếm.'}</p>
                    return list.map(({ n, spot, item }) => (
                        <button key={`${n.spotId}|${n.itemId}|${n.writtenBy}`} onClick={() => props.onOpen(spot.id)} className="block w-full border-t border-lys-border p-3 text-left first:border-t-0">
                            <div className="text-xs text-lys-muted">{spot.name} · {n.writtenBy} · {when(n.updatedAt)}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                                {item
                                    ? <>{item.kind !== 'POSM' && <><Code c={item.code} /><Vintage v={item.vintage} /></>}<span>{item.name}</span></>
                                    : <span className="font-semibold">Cả vị trí</span>}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm">{n.note}</div>
                        </button>
                    ))
                })()}
                {props.mode === 'spot' && props.groups.map(g => {
                    const isT2 = g.name === 'Tầng 2'
                    return (
                        <div key={g.name}>
                            <div className="flex justify-between bg-tone-brand-bg px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-tone-brand-fg">
                                <span>{g.name}</span>
                                <b className="normal-case">
                                    {g.kind === 'POSM'
                                        ? `${fmt(s.posmTotal)} cái`
                                        : isT2
                                            ? `${fmt(s.t2Cases)} thùng + ${fmt(s.t2Loose)} lẻ = ${fmt(groupTotal(g.name))} chai`
                                            : `${fmt(groupTotal(g.name))} chai`}
                                </b>
                            </div>
                            {g.spots.map(spot => {
                                const ss = s.spots.find(x => x.spot.id === spot.id)
                                const t2Spot = isCaseSpot(spot)
                                return (
                                    <button key={spot.id} onClick={() => props.onOpen(spot.id)} className={`${row} w-full text-left`}>
                                        <div>
                                            <div className="font-medium">{spot.name}</div>
                                            <div className="mt-1 text-xs text-lys-muted">
                                                {ss?.touched
                                                    ? `${ss.lines} dòng có hàng${t2Spot ? ` · ${fmt(ss.cases)} thùng + ${fmt(ss.loose)} chai lẻ` : ''} · kiểm lại ${ss.rechecked}/${ss.cells} · ${ss.people.join(', ')} · ${ss.lastAt ? when(ss.lastAt) : ''}`
                                                    : 'Chưa kiểm'}
                                            </div>
                                        </div>
                                        <div className={`self-center text-[21px] font-bold ${ss?.touched ? '' : 'text-lys-dim'}`}>{ss?.touched ? fmt(ss.qty) : '–'}</div>
                                    </button>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
            <div className="space-y-2 rounded-xl border border-lys-border bg-lys-surface p-3">
                <b className="text-sm">Tải biên bản kiểm kê (có chỗ ký) — In / Lưu PDF</b>
                <div className="grid grid-cols-2 gap-2">
                    {props.groups.map(g => (
                        <a key={g.name} href={`/kiem-ke/bien-ban?g=${encodeURIComponent(g.name)}`} target="_blank" rel="noopener"
                            className="rounded-lg bg-lys-teal-strong py-2.5 text-center font-semibold text-white">Biên bản {g.name}</a>
                    ))}
                </div>
            </div>
            <button onClick={props.onExport} className="w-full rounded-lg border border-lys-teal-strong py-3 font-semibold text-lys-teal-strong">Tải kết quả (.csv)</button>
        </div>
    )
}

function PackView(props: {
    header: React.ReactNode
    errorNote: React.ReactNode
    wineItems: ShowroomItem[]
    summary: Summary
    q: string
    setQ: (v: string) => void
    filter: PackFilter
    setFilter: (f: PackFilter) => void
    onChangePackSize: (code: string, packSize: number) => Promise<string | null>
}) {
    const [busyCode, setBusyCode] = useState<string | null>(null)
    const [errMsg, setErrMsg] = useState<Map<string, string>>(new Map())

    const codes = useMemo(() => {
        const byCode = new Map<string, { code: string; name: string; packSize: number; vintages: string[]; t2Cases: number; t2Loose: number; t2Total: number }>()
        const itemSumById = new Map(props.summary.wineFound.map(x => [x.item.id, x]))
        for (const item of props.wineItems) {
            const pack = packSizeOf(item) ?? 6
            const cur = byCode.get(item.code) ?? {
                code: item.code,
                name: item.name,
                packSize: pack,
                vintages: [],
                t2Cases: 0,
                t2Loose: 0,
                t2Total: 0,
            }
            if (!cur.vintages.includes(item.vintage)) cur.vintages.push(item.vintage)
            const is = itemSumById.get(item.id)
            if (is && (is.byGroup['Tầng 2'] ?? 0) > 0) {
                cur.t2Cases += is.t2Cases
                cur.t2Loose += is.t2Loose
                cur.t2Total += is.byGroup['Tầng 2'] ?? 0
            }
            byCode.set(item.code, cur)
        }
        return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
    }, [props.wineItems, props.summary.wineFound])

    const count12 = useMemo(() => codes.filter(c => c.packSize === 12).length, [codes])
    const count6 = codes.length - count12

    const shown = useMemo(() => {
        const q = normalizeSearch(props.q.trim())
        return codes.filter(c => {
            if (props.filter === '12' && c.packSize !== 12) return false
            if (props.filter === '6' && c.packSize !== 6) return false
            return !q || normalizeSearch(`${c.code} ${c.name} ${c.vintages.join(' ')}`).includes(q)
        })
    }, [codes, props.q, props.filter])

    const changePack = async (code: string, nextPack: 6 | 12) => {
        setBusyCode(code)
        const err = await props.onChangePackSize(code, nextPack)
        setBusyCode(null)
        setErrMsg(m => {
            const n = new Map(m)
            if (err) n.set(code, err)
            else n.delete(code)
            return n
        })
    }

    return (
        <div className="space-y-4">
            {props.header}
            {props.errorNote}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-lys-border bg-lys-surface px-3 py-2.5">
                    <div className="text-2xl font-bold">{codes.length}</div>
                    <div className="text-xs text-lys-muted">mã rượu</div>
                </div>
                <div className="rounded-xl border border-lys-teal-strong bg-tone-brand-bg px-3 py-2.5">
                    <div className="text-2xl font-bold text-lys-teal-strong">{count12}</div>
                    <div className="text-xs font-medium text-tone-brand-fg">thùng 12 chai</div>
                </div>
                <div className="rounded-xl border border-lys-border bg-lys-surface px-3 py-2.5">
                    <div className="text-2xl font-bold">{count6}</div>
                    <div className="text-xs text-lys-muted">thùng 6 chai</div>
                </div>
            </div>

            <SearchBox id="packSearch" value={props.q} onChange={props.setQ} placeholder="Tìm mã hoặc tên rượu (vd: L10039, Calabria)…" />

            <div role="group" aria-label="Lọc theo quy cách" className="grid grid-cols-3 gap-1 rounded-lg border border-lys-border bg-lys-surface p-1">
                {([
                    ['all', `Tất cả (${codes.length})`],
                    ['12', `Thùng 12 (${count12})`],
                    ['6', `Thùng 6 (${count6})`],
                ] as const).map(([v, l]) => (
                    <button key={v} aria-pressed={props.filter === v} onClick={() => props.setFilter(v)}
                        className={`rounded-md px-2 py-2 text-sm ${props.filter === v ? 'bg-lys-teal-strong font-semibold text-white' : 'text-lys-muted'}`}>
                        {l}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-lys-border bg-lys-surface">
                {!shown.length && (
                    <p className="p-6 text-center text-lys-muted">
                        <b className="block text-lys-primary">Không tìm thấy mã rượu nào</b>
                        Thử tìm bằng mã (ví dụ L100, L400) hoặc một phần tên rượu.
                    </p>
                )}
                {shown.map(c => {
                    const busy = busyCode === c.code
                    const err = errMsg.get(c.code)
                    return (
                        <div key={c.code} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-lys-border p-3 first:border-t-0">
                            <div>
                                <div className="text-sm font-medium leading-snug">{c.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-lys-muted">
                                    <Code c={c.code} />
                                    {c.vintages.map(v => <Vintage key={v || 'NV'} v={v} />)}
                                </div>
                                {c.t2Total > 0 && (
                                    <div className="mt-1 text-xs font-medium text-lys-teal-strong">
                                        Tầng 2 đã đếm: {c.t2Cases} thùng + {c.t2Loose} lẻ = {fmt(c.t2Total)} chai
                                    </div>
                                )}
                                {err && <div className="mt-1 text-xs text-tone-danger-fg">{err}</div>}
                            </div>

                            <div className="inline-flex overflow-hidden rounded-lg border border-lys-border bg-lys-bg p-0.5">
                                {([6, 12] as const).map(size => {
                                    const active = c.packSize === size
                                    return (
                                        <button
                                            key={size}
                                            type="button"
                                            disabled={busy}
                                            aria-pressed={active}
                                            onClick={() => { if (!active) changePack(c.code, size) }}
                                            className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                                                active
                                                    ? 'bg-lys-teal-strong text-white'
                                                    : 'text-lys-muted hover:text-lys-primary'
                                            }`}
                                        >
                                            {size}c/thùng
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <p className="text-sm text-lys-muted">
                Quy cách đóng gói dùng để tính tổng số chai khi nhập Số thùng + Chai lẻ ở khu vực Tầng 2. Khi đổi quy cách tại đây, các dòng đã đếm ở Tầng 2 của mã đó sẽ tự động tính lại tổng số chai tương ứng.
            </p>
        </div>
    )
}
