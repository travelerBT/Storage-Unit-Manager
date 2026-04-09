import React, { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Bot, CheckCircle2, Loader2,
  Plus, UploadCloud, Warehouse, X,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { GoogleGenerativeAI } from '@google/generative-ai'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { facilityService, unitService } from '@/lib/services'
import { useAuth } from '@/contexts/AuthContext'
import type { UnitType } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetectedUnit {
  id: string
  designation: string
  sqft?: number
}

interface FloorData {
  floorNumber: number
  unitType: UnitType
  pricePerSqft: number
  imageDataUrl: string | null
  imageBase64: string | null
  mimeType: string
  units: DetectedUnit[]
  analyzed: boolean
  analyzing: boolean
  notes: string
}

type WizardStep = 'floors' | 'analyze' | 'review'

const UNIT_TYPE_COLORS: Record<UnitType, string> = {
  standard:           'border-blue-400 bg-blue-400/15 text-blue-800',
  climate_controlled: 'border-violet-400 bg-violet-400/15 text-violet-800',
  drive_up:           'border-emerald-400 bg-emerald-400/15 text-emerald-800',
  outdoor:            'border-amber-400 bg-amber-400/15 text-amber-800',
  vehicle:            'border-orange-400 bg-orange-400/15 text-orange-800',
  wine:               'border-pink-400 bg-pink-400/15 text-pink-800',
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up:           'Drive-Up',
  outdoor:            'Outdoor',
  vehicle:            'Vehicle',
  wine:               'Wine',
}

const MAX_IMAGE_DIM = 1536

// ─── Utilities ───────────────────────────────────────────────────────────────

async function pdfPageToBase64(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const scale = MAX_IMAGE_DIM / Math.max(page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height)
  const viewport = page.getViewport({ scale: Math.min(scale, 3) })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  return { dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' }
}

async function imageFileToBase64(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const out = canvas.toDataURL('image/jpeg', 0.92)
        resolve({ dataUrl: out, base64: out.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = dataUrl
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── FloorExtractPanel ────────────────────────────────────────────────────────

function FloorExtractPanel({
  floor,
  onFileSelected,
  onAnalyze,
  onAddUnit,
  onDeleteUnit,
  onUpdateUnit,
}: {
  floor: FloorData
  onFileSelected: (file: File) => void
  onAnalyze: () => void
  onAddUnit: (designation: string) => void
  onDeleteUnit: (id: string) => void
  onUpdateUnit: (id: string, designation: string, sqft?: number) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesig, setEditDesig] = useState('')
  const [editSqft, setEditSqft] = useState('')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelected(file)
  }, [onFileSelected])

  const commitAdd = () => {
    const v = addValue.trim()
    if (v) { onAddUnit(v); setAddValue('') }
  }

  const startEdit = (unit: DetectedUnit) => {
    setEditingId(unit.id)
    setEditDesig(unit.designation)
    setEditSqft(unit.sqft != null ? String(unit.sqft) : '')
  }

  const commitEdit = () => {
    if (editingId && editDesig.trim()) {
      const sqft = editSqft.trim() ? parseInt(editSqft) || undefined : undefined
      onUpdateUnit(editingId, editDesig.trim(), sqft)
    }
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      {!floor.imageDataUrl ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-colors cursor-pointer',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60',
          )}
        >
          <input
            type="file"
            title="Upload floor plan"
            aria-label="Upload floor plan"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f) }}
          />
          <UploadCloud className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop your floor plan here</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, or WebP · Unit numbers must be labeled on the plan</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border bg-gray-50 overflow-hidden">
            <img
              src={floor.imageDataUrl}
              alt={`Floor ${floor.floorNumber} plan`}
              className="w-full h-auto block max-h-[45vh] object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            {!floor.analyzed ? (
              <Button className="flex-1" onClick={onAnalyze} disabled={floor.analyzing}>
                {floor.analyzing
                  ? <><Loader2 className="mr-2 size-4 animate-spin" />Reading labels…</>
                  : <><Bot className="mr-2 size-4" />Extract Unit Labels with AI</>}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onAnalyze} disabled={floor.analyzing}>
                  {floor.analyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                  <span className="ml-1.5">Re-extract</span>
                </Button>
                <span className="ml-auto text-sm text-muted-foreground font-medium">
                  {floor.units.length} units found
                </span>
              </>
            )}
            <label className="cursor-pointer shrink-0">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                <UploadCloud className="size-3.5" />Change
              </span>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f) }}
              />
            </label>
          </div>
          {floor.notes && (
            <p className="text-xs text-muted-foreground italic bg-muted/40 rounded px-3 py-2">
              <Bot className="inline size-3.5 mr-1 -mt-0.5" />{floor.notes}
            </p>
          )}
        </div>
      )}

      {/* Unit tag editor */}
      {floor.analyzed && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Detected Units</p>
            <span className="text-xs text-muted-foreground">{floor.units.length} total · click to edit label & sqft · hover to remove</span>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[40px]">
            {floor.units.map((u) =>
              editingId === u.id ? (
                <div key={u.id} className="flex items-center gap-1">
                  <Input
                    className="h-7 w-20 text-xs font-mono px-1.5"
                    value={editDesig}
                    onChange={(e) => setEditDesig(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    onBlur={commitEdit}
                    autoFocus
                    placeholder="Label"
                  />
                  <Input
                    className="h-7 w-16 text-xs font-mono px-1.5"
                    value={editSqft}
                    onChange={(e) => setEditSqft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    onBlur={commitEdit}
                    placeholder="sqft"
                    type="number"
                    min={0}
                  />
                </div>
              ) : (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-mono font-medium cursor-pointer hover:bg-muted group"
                  onClick={() => startEdit(u)}
                >
                  {u.designation}
                  {u.sqft != null && u.sqft > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{u.sqft}sf</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${u.designation}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteUnit(u.id) }}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              )
            )}
            {/* Inline add */}
            <div className="flex items-center gap-1">
              <Input
                className="h-7 w-20 text-xs font-mono px-1.5"
                placeholder="Add…"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitAdd() }}
              />
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={commitAdd} disabled={!addValue.trim()}>
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FloorPlanSetupPage() {
  const { facilityId } = useParams<{ facilityId: string }>()
  const navigate = useNavigate()
  const { appUser } = useAuth()
  const qc = useQueryClient()

  const [step, setStep] = useState<WizardStep>('floors')
  const [numFloors, setNumFloors] = useState(1)
  const [floorTypes, setFloorTypes] = useState<UnitType[]>(['standard'])
  const [floorPrices, setFloorPrices] = useState<number[]>([0])
  const [currentFloor, setCurrentFloor] = useState(0)
  const [floors, setFloors] = useState<FloorData[]>([])
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)

  const { data: facility } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => facilityService.getById(facilityId!),
    enabled: !!facilityId,
  })

  const handleConfigureFloors = () => {
    const count = Math.max(1, Math.min(20, numFloors))
    setFloors(Array.from({ length: count }, (_, i) => ({
      floorNumber: i + 1,
      unitType: floorTypes[i] ?? 'standard',
      pricePerSqft: floorPrices[i] ?? 0,
      imageDataUrl: null,
      imageBase64: null,
      mimeType: 'image/jpeg',
      units: [],
      analyzed: false,
      analyzing: false,
      notes: '',
    })))
    setCurrentFloor(0)
    setStep('analyze')
  }

  const handleFileSelected = async (floorIdx: number, file: File) => {
    try {
      const result = file.type === 'application/pdf'
        ? await pdfPageToBase64(file)
        : await imageFileToBase64(file)
      setFloors((prev) => prev.map((f, i) =>
        i === floorIdx
          ? { ...f, imageDataUrl: result.dataUrl, imageBase64: result.base64, mimeType: result.mimeType, analyzed: false, units: [], notes: '' }
          : f
      ))
    } catch {
      toast.error('Could not process file. Try a different image or PDF.')
    }
  }

  const handleAnalyze = async (floorIdx: number) => {
    const floor = floors[floorIdx]
    if (!floor.imageBase64) return
    setFloors((prev) => prev.map((f, i) => i === floorIdx ? { ...f, analyzing: true } : f))
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string
      if (!apiKey) throw new Error('Gemini API key not configured')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `This image is a labeled floor plan of a storage facility. Each storage unit cell has a number or code printed inside it.

Read every unit label visible in the image. For each unit, also read the square footage if printed (shown as "5x10", "50 sq ft", "50 SF", or a standalone number like "50").

Return ONLY raw JSON with no markdown fences:
{
  "units": [
    {"designation": "101", "sqft": 50},
    {"designation": "102", "sqft": null}
  ],
  "notes": "X unit labels found"
}
Use null for sqft when not visible. For dimension formats like "5x10", calculate the area (5×10=50).`

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: floor.imageBase64, mimeType: floor.mimeType } },
            { text: prompt },
          ],
        }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as never,
      })

      const raw = result.response.text().trim()
      const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed: { units: Array<{ designation: string; sqft: number | null }>; notes?: string } = JSON.parse(jsonText)
      const floorNumber = floor.floorNumber
      const units: DetectedUnit[] = (parsed.units ?? []).map((item, i) => ({
        id: `temp_${floorNumber}_${i}`,
        designation: String(item.designation),
        sqft: item.sqft != null && item.sqft > 0 ? item.sqft : undefined,
      }))
      setFloors((prev) => prev.map((f, i) =>
        i === floorIdx ? { ...f, units, notes: parsed.notes ?? '', analyzed: true, analyzing: false } : f
      ))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed')
      setFloors((prev) => prev.map((f, i) => i === floorIdx ? { ...f, analyzing: false } : f))
    }
  }

  const addUnit = (floorIdx: number, designation: string) => {
    setFloors((prev) => prev.map((f, i) =>
      i === floorIdx
        ? { ...f, analyzed: true, units: [...f.units, { id: `manual_${floorIdx}_${Date.now()}`, designation }] }
        : f
    ))
  }

  const deleteUnit = (floorIdx: number, unitId: string) => {
    setFloors((prev) => prev.map((f, i) =>
      i === floorIdx ? { ...f, units: f.units.filter((u) => u.id !== unitId) } : f
    ))
  }

  const updateUnit = (floorIdx: number, unitId: string, designation: string, sqft?: number) => {
    setFloors((prev) => prev.map((f, i) =>
      i === floorIdx
        ? { ...f, units: f.units.map((u) => u.id === unitId ? { ...u, designation, sqft } : u) }
        : f
    ))
  }

  const totalUnits = floors.reduce((acc, f) => acc + f.units.length, 0)

  const handleCreateUnits = async () => {
    if (!facilityId || !appUser) return
    setCreating(true)
    try {
      const businessId = appUser.businessId ?? ''
      let count = 0
      for (const floor of floors) {
        for (const unit of floor.units) {
          const sqft = unit.sqft ?? 0
          const pricePerMonth = sqft > 0 && floor.pricePerSqft > 0
            ? Math.round(sqft * floor.pricePerSqft * 100) / 100
            : 0
          await unitService.create({
            facilityId,
            businessId,
            unitNumber: unit.designation,
            floor: floor.floorNumber,
            width: 0,
            height: 0,
            sqft,
            type: floor.unitType,
            status: 'available',
            pricePerMonth,
            securityDeposit: 0,
            features: [],
          })
          count++
        }
      }
      toast.success(`Created ${count} units successfully`)
      await facilityService.update(facilityId!, { totalUnits: count })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      void qc.invalidateQueries({ queryKey: ['facility', facilityId] })
      setCreated(true)
    } catch (err) {
      toast.error('Failed to create some units. Try again.')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const analyzedFloors = floors.filter((f) => f.analyzed)

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="-ml-2" onClick={() => navigate(`/owner/facilities/${facilityId}`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Unit Setup</h1>
          <p className="text-sm text-muted-foreground">
            {facility?.name ?? '…'} · Upload a labeled floor plan to extract unit numbers automatically
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['floors', 'analyze', 'review'] as WizardStep[]).map((s, idx) => {
          const labels = { floors: 'Configure Floors', analyze: 'Extract Labels', review: 'Review & Create' }
          const active = step === s
          const done = (step === 'analyze' && s === 'floors') || (step === 'review' && s !== 'review')
          return (
            <React.Fragment key={s}>
              {idx > 0 && <div className="h-px flex-1 bg-border" />}
              <div className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/50',
              )}>
                {done ? <CheckCircle2 className="size-3.5" /> : <span className="text-xs">{idx + 1}</span>}
                {labels[s]}
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Step 1 */}
      {step === 'floors' && (
        <div className="max-w-sm mx-auto space-y-6 pt-4">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Warehouse className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">How many floors?</p>
                <p className="text-xs text-muted-foreground">Each floor gets its own floor plan upload</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Number of floors</Label>
              <Input
                type="number" min={1} max={20} value={numFloors}
                onChange={(e) => {
                  const count = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                  setNumFloors(count)
                  setFloorTypes((prev) => {
                    const next = [...prev]
                    while (next.length < count) next.push('standard')
                    return next.slice(0, count)
                  })
                  setFloorPrices((prev) => {
                    const next = [...prev]
                    while (next.length < count) next.push(0)
                    return next.slice(0, count)
                  })
                }}
                className="text-center text-lg font-bold h-12"
              />
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[4rem_1fr_6rem] gap-2 text-xs text-muted-foreground font-medium">
                <span>Floor</span><span>Unit Type</span><span className="text-right">$/sqft</span>
              </div>
              {Array.from({ length: numFloors }, (_, i) => (
                <div key={i} className="grid grid-cols-[4rem_1fr_6rem] items-center gap-2">
                  <span className="text-sm font-medium">{i + 1}</span>
                  <Select
                    value={floorTypes[i] ?? 'standard'}
                    onValueChange={(val) => setFloorTypes((prev) => {
                      const next = [...prev]; next[i] = val as UnitType; return next
                    })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                        <SelectItem key={t} value={t}>{UNIT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      type="number" min={0} step={0.01}
                      value={floorPrices[i] ?? 0}
                      onChange={(e) => setFloorPrices((prev) => {
                        const next = [...prev]
                        next[i] = parseFloat(e.target.value) || 0
                        return next
                      })}
                      className="h-8 text-sm pl-5 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleConfigureFloors}>
              Continue <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 'analyze' && (
        <div className="space-y-4">
          {floors.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {floors.map((floor, idx) => (
                <button
                  key={floor.floorNumber} type="button"
                  onClick={() => setCurrentFloor(idx)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    currentFloor === idx ? 'bg-primary text-primary-foreground border-primary'
                      : floor.analyzed ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {floor.analyzed && <CheckCircle2 className="inline size-3 mr-1 -mt-0.5" />}
                  Floor {floor.floorNumber}
                  {floor.analyzed && <span className="ml-1 text-xs opacity-75">({floor.units.length})</span>}
                </button>
              ))}
            </div>
          )}
          {floors[currentFloor] && (
            <FloorExtractPanel
              floor={floors[currentFloor]}
              onFileSelected={(file) => handleFileSelected(currentFloor, file)}
              onAnalyze={() => handleAnalyze(currentFloor)}
              onAddUnit={(d) => addUnit(currentFloor, d)}
              onDeleteUnit={(id) => deleteUnit(currentFloor, id)}
              onUpdateUnit={(id, d, sqft) => updateUnit(currentFloor, id, d, sqft)}
            />
          )}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep('floors')}>
              <ArrowLeft className="mr-2 size-4" />Back
            </Button>
            <div className="flex items-center gap-2">
              {currentFloor > 0 && (
                <Button variant="outline" onClick={() => setCurrentFloor((p) => p - 1)}>
                  ← Floor {floors[currentFloor - 1]?.floorNumber}
                </Button>
              )}
              {currentFloor < floors.length - 1 ? (
                <Button onClick={() => setCurrentFloor((p) => p + 1)}>
                  Floor {floors[currentFloor + 1]?.floorNumber} →
                </Button>
              ) : (
                <Button disabled={analyzedFloors.length === 0} onClick={() => setStep('review')}>
                  Review <ArrowRight className="ml-2 size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 'review' && (
        <div className="space-y-6">
          {created ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold">Units created!</p>
                <p className="text-muted-foreground text-sm mt-1">{totalUnits} units have been added to your facility.</p>
              </div>
              <Button onClick={() => navigate(`/owner/facilities/${facilityId}`)}>View Facility</Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{totalUnits} units ready to create</p>
                    <p className="text-sm text-muted-foreground">
                      Across {analyzedFloors.length} floor{analyzedFloors.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Warehouse className="size-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-3">
                  {floors.filter((f) => f.units.length > 0).map((floor) => (
                    <div key={floor.floorNumber} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">Floor {floor.floorNumber}</p>
                          <Badge variant="outline" className={cn('text-xs', UNIT_TYPE_COLORS[floor.unitType])}>
                            {UNIT_TYPE_LABELS[floor.unitType]}
                          </Badge>
                          {floor.pricePerSqft > 0 && (
                            <span className="text-xs text-muted-foreground">${floor.pricePerSqft}/sqft</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{floor.units.length} units</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {floor.units.map((u) => {
                          const price = u.sqft && floor.pricePerSqft > 0
                            ? Math.round(u.sqft * floor.pricePerSqft * 100) / 100
                            : null
                          return (
                            <span key={u.id} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                              {u.designation}
                              {u.sqft != null && u.sqft > 0 && (
                                <span className="text-muted-foreground">{u.sqft}sf</span>
                              )}
                              {price != null && (
                                <span className="text-emerald-700 font-semibold">${price}/mo</span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setStep('analyze')}>
                  <ArrowLeft className="mr-2 size-4" />Back to Edit
                </Button>
                <Button className="flex-1" size="lg" onClick={handleCreateUnits} disabled={creating || totalUnits === 0}>
                  {creating
                    ? <><Loader2 className="mr-2 size-4 animate-spin" />Creating units…</>
                    : <><CheckCircle2 className="mr-2 size-4" />Create {totalUnits} Units</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
