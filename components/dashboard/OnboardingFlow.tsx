"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { IconYoutube, IconTikTok, FlagFR, FlagUK, FlagES, FlagDE } from "@/components/ui/icons"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface CategoryPreset {
    id: number
    slug: string
    name: string
    icon: string
    description: string | null
    default_aspect_ratio: string
    default_duration: number
    default_language: string
    default_visual_style: string | null
}

interface OnboardingFlowProps {
    preset: CategoryPreset
    onBack: () => void
    onProjectCreated: (project: any) => void
}

interface AIQuestion {
    id: string
    question: string
    type: "text" | "select" | "textarea"
    placeholder?: string
    options?: string[]
}

const LANGUAGES = [
    { code: "French", label: "Français", icon: FlagFR },
    { code: "English", label: "English", icon: FlagUK },
    { code: "Spanish", label: "Español", icon: FlagES },
    { code: "German", label: "Deutsch", icon: FlagDE },
]

export function OnboardingFlow({ preset, onBack, onProjectCreated }: OnboardingFlowProps) {
    const [step, setStep] = useState(1)
    const [isCreating, setIsCreating] = useState(false)

    // Form Data (Step 2)
    const [title, setTitle] = useState("")
    const [language, setLanguage] = useState(preset.default_language)
    const [durationSeconds, setDurationSeconds] = useState([preset.default_duration])
    const [aspectRatio, setAspectRatio] = useState(preset.default_aspect_ratio)

    // Form Data (Step 2)
    const [pitch, setPitch] = useState("")
    const [aiModeEnabled, setAiModeEnabled] = useState(false)

    // AI State
    const [detectedTags, setDetectedTags] = useState<string[]>([])
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([])
    const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({})
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)

    const totalSteps = aiModeEnabled ? 3 : 2

    // Debounced pitch analysis
    useEffect(() => {
        if (!aiModeEnabled || pitch.length < 10) {
            setDetectedTags([])
            return
        }

        const timer = setTimeout(async () => {
            setIsAnalyzing(true)
            try {
                const res = await fetch("http://127.0.0.1:8000/api/onboarding/analyze-pitch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pitch, category_slug: preset.slug })
                })
                if (res.ok) {
                    const data = await res.json()
                    setDetectedTags(data.tags || [])
                }
            } catch (e) {
                console.error("Error analyzing pitch:", e)
            } finally {
                setIsAnalyzing(false)
            }
        }, 800) // 800ms debounce

        return () => clearTimeout(timer)
    }, [pitch, aiModeEnabled, preset.slug])

    // Load AI questions when entering step 3
    useEffect(() => {
        if (step === 3 && aiModeEnabled && aiQuestions.length === 0) {
            loadAIQuestions()
        }
    }, [step, aiModeEnabled])

    const loadAIQuestions = async () => {
        setIsLoadingQuestions(true)
        try {
            const res = await fetch("http://127.0.0.1:8000/api/onboarding/generate-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    pitch,
                    category_slug: preset.slug,
                    detected_tags: detectedTags,
                    existing_answers: aiAnswers
                })
            })
            if (res.ok) {
                const data = await res.json()
                setAiQuestions(data.questions || [])
            }
        } catch (e) {
            console.error("Error loading questions:", e)
        } finally {
            setIsLoadingQuestions(false)
        }
    }

    const createProject = async () => {
        setIsCreating(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const durationStr = durationSeconds[0] < 60
                ? `${durationSeconds[0]}s`
                : `${Math.floor(durationSeconds[0] / 60)} min${Math.floor(durationSeconds[0] / 60) > 1 ? 's' : ''}`

            const res = await fetch("http://127.0.0.1:8000/api/projects", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: title || "Untitled Project",
                    language,
                    target_duration: durationStr,
                    aspect_ratio: aspectRatio,
                    pitch,
                    category_preset_id: preset.id,
                    detected_tags: detectedTags,
                    ai_answers: aiAnswers
                })
            })

            if (!res.ok) throw new Error("Failed to create project")

            const newProject = await res.json()
            onProjectCreated(newProject)
        } catch (e) {
            console.error(e)
            alert("Erreur lors de la création du projet")
        } finally {
            setIsCreating(false)
        }
    }

    const goToProd = () => {
        createProject()
    }

    const nextStep = () => {
        if (step < totalSteps) {
            setStep(step + 1)
        } else {
            createProject()
        }
    }

    const prevStep = () => {
        if (step > 1) {
            setStep(step - 1)
        } else {
            onBack()
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-8">
                <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4" /> Retour
                </Button>

                {/* Step Indicator */}
                <div className="flex items-center gap-2">
                    <span className="text-4xl mr-4">{preset.icon}</span>
                    <span className="font-semibold text-lg">{preset.name}</span>
                    <span className="text-muted-foreground mx-4">•</span>
                    {[1, 2, 3, 4].slice(0, totalSteps).map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                                step === s ? "bg-[var(--accent-pink)] neon-glow-sm" : step > s ? "bg-[var(--accent-pink)]" : "bg-muted"
                            )} />
                            {s < totalSteps && <div className={cn("w-8 h-0.5 mx-1 rounded-full transition-colors duration-300", step > s ? "bg-[var(--accent-pink)]" : "bg-muted")} />}
                        </div>
                    ))}
                </div>

                {/* Skip to Prod Button */}
                <Button
                    variant="outline"
                    className="gap-2 border-[var(--accent-pink)] text-[var(--accent-pink)] hover:bg-[var(--accent-pink)]/10"
                    onClick={goToProd}
                    disabled={isCreating}
                >
                    Aller à la prod <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Main Content */}
            <Card className="flex-1 p-8 shadow-2xl border-[var(--accent-pink)]/20 bg-card rounded-3xl flex flex-col relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-pink)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative flex-1">
                    {/* STEP 2: Base Parameters */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold mb-2">Paramètres de base</h2>
                                <p className="text-muted-foreground">Configurez les paramètres principaux de votre projet</p>
                            </div>

                            <div className="grid gap-6 max-w-2xl mx-auto">
                                {/* Title */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Titre du projet</label>
                                    <Input
                                        placeholder="Mon super projet..."
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="h-12 text-lg bg-muted/30 border-muted focus-visible:ring-[var(--accent-pink)]/30 focus-visible:border-[var(--accent-pink)]"
                                        autoFocus
                                    />
                                </div>

                                {/* Language & Duration Row */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Langue</label>
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger className="h-12 bg-muted/30 border-muted">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LANGUAGES.map(lang => (
                                                    <SelectItem key={lang.code} value={lang.code}>
                                                        <div className="flex items-center gap-2">
                                                            <lang.icon className="w-5 h-4 rounded-sm" />
                                                            <span>{lang.label}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium">Durée cible</label>
                                            <span className="text-sm font-mono bg-[var(--accent-pink)]/10 text-[var(--accent-pink)] px-3 py-1 rounded-full">
                                                {durationSeconds[0] < 60 ? `${durationSeconds[0]}s` : `${Math.floor(durationSeconds[0] / 60)} min`}
                                            </span>
                                        </div>
                                        <Slider
                                            value={durationSeconds}
                                            onValueChange={setDurationSeconds}
                                            max={180}
                                            min={10}
                                            step={10}
                                            className="py-4"
                                        />
                                    </div>
                                </div>

                                {/* Aspect Ratio */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Format</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className={cn(
                                                "flex items-center gap-4 cursor-pointer p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                                aspectRatio === "16:9" ? "border-[var(--accent-pink)] bg-[var(--accent-pink)]/5 neon-glow-sm" : "border-muted hover:border-foreground/20"
                                            )}
                                            onClick={() => setAspectRatio("16:9")}
                                        >
                                            <IconYoutube className={cn("w-8 h-8", aspectRatio === "16:9" ? "text-red-600" : "text-muted-foreground")} />
                                            <div>
                                                <span className="block font-bold">YouTube</span>
                                                <span className="text-xs text-muted-foreground">16:9 Paysage</span>
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center gap-4 cursor-pointer p-4 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                                aspectRatio === "9:16" ? "border-[var(--accent-pink)] bg-[var(--accent-pink)]/5 neon-glow-sm" : "border-muted hover:border-foreground/20"
                                            )}
                                            onClick={() => setAspectRatio("9:16")}
                                        >
                                            <IconTikTok className={cn("w-8 h-8", aspectRatio === "9:16" ? "text-foreground" : "text-muted-foreground")} />
                                            <div>
                                                <span className="block font-bold">TikTok / Shorts</span>
                                                <span className="text-xs text-muted-foreground">9:16 Portrait</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Pitch + AI Mode */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold mb-2">Décris ton projet</h2>
                                <p className="text-muted-foreground">Donne-nous une idée de ce que tu veux créer</p>
                            </div>

                            <div className="max-w-2xl mx-auto space-y-6">
                                <Textarea
                                    placeholder="Décris ton projet en quelques mots... Ex: Une pub pour des sneakers Nike, ambiance street avec un danseur hip-hop"
                                    value={pitch}
                                    onChange={e => setPitch(e.target.value)}
                                    className="min-h-[150px] text-lg bg-muted/30 border-muted focus-visible:ring-[var(--accent-pink)]/30 focus-visible:border-[var(--accent-pink)]"
                                />

                                {/* AI Mode Toggle */}
                                <div
                                    className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all",
                                        aiModeEnabled ? "border-[var(--accent-pink)] bg-[var(--accent-pink)]/5 neon-glow-sm" : "border-muted hover:border-muted-foreground/50"
                                    )}
                                    onClick={() => setAiModeEnabled(!aiModeEnabled)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles className={cn("w-5 h-5", aiModeEnabled ? "text-[var(--accent-pink)]" : "text-muted-foreground")} />
                                        <div>
                                            <span className={cn("font-semibold", aiModeEnabled && "text-[var(--accent-pink)]")}>
                                                Activer l'assistant IA
                                            </span>
                                            <p className="text-xs text-muted-foreground">
                                                L'IA analysera ton projet et posera des questions intelligentes
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "w-12 h-6 rounded-full p-1 transition-colors",
                                        aiModeEnabled ? "bg-[var(--accent-pink)]" : "bg-muted"
                                    )}>
                                        <div className={cn(
                                            "w-4 h-4 rounded-full bg-white transition-transform",
                                            aiModeEnabled && "translate-x-6"
                                        )} />
                                    </div>
                                </div>

                                {/* Detected Tags (when AI mode is enabled) */}
                                {aiModeEnabled && pitch.length >= 10 && (
                                    <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                                        {isAnalyzing ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Analyse en cours...
                                            </div>
                                        ) : detectedTags.length > 0 ? (
                                            <>
                                                <span className="text-xs text-muted-foreground">Tags détectés :</span>
                                                {detectedTags.map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-1 text-xs rounded-full bg-[var(--accent-pink)]/10 text-[var(--accent-pink)] border border-[var(--accent-pink)]/30"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: AI Dynamic Questions (if enabled) */}
                    {step === 3 && aiModeEnabled && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold mb-2">
                                    <Sparkles className="inline w-6 h-6 mr-2 text-[var(--accent-pink)]" />
                                    Questions IA
                                </h2>
                                <p className="text-muted-foreground">L'assistant a quelques questions pour affiner ton projet</p>
                            </div>

                            <div className="max-w-2xl mx-auto space-y-6">
                                {isLoadingQuestions ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-pink)] mb-4" />
                                        <p className="text-muted-foreground">Génération des questions...</p>
                                    </div>
                                ) : aiQuestions.length > 0 ? (
                                    aiQuestions.map((q) => (
                                        <div key={q.id} className="space-y-2">
                                            <label className="text-sm font-medium">{q.question}</label>
                                            {q.type === "select" && q.options ? (
                                                <Select
                                                    value={aiAnswers[q.id] || ""}
                                                    onValueChange={(val) => setAiAnswers(prev => ({ ...prev, [q.id]: val }))}
                                                >
                                                    <SelectTrigger className="h-12 bg-muted/30 border-muted">
                                                        <SelectValue placeholder="Sélectionne une option" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {q.options.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : q.type === "textarea" ? (
                                                <Textarea
                                                    placeholder={q.placeholder || ""}
                                                    value={aiAnswers[q.id] || ""}
                                                    onChange={(e) => setAiAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    className="min-h-[100px] bg-muted/30 border-muted focus-visible:ring-[var(--accent-pink)]/30"
                                                />
                                            ) : (
                                                <Input
                                                    placeholder={q.placeholder || ""}
                                                    value={aiAnswers[q.id] || ""}
                                                    onChange={(e) => setAiAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    className="h-12 bg-muted/30 border-muted focus-visible:ring-[var(--accent-pink)]/30"
                                                />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-muted-foreground">Pas de questions supplémentaires pour ce projet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="flex justify-between items-center pt-6 mt-auto border-t border-border/50">
                    <div className="text-sm text-muted-foreground">
                        Étape {step} sur {totalSteps}
                    </div>

                    <Button
                        onClick={nextStep}
                        disabled={isCreating}
                        size="lg"
                        className={cn(
                            "px-8 text-base transition-all",
                            (step === totalSteps || (step === 2 && !aiModeEnabled))
                                ? "bg-[var(--accent-pink)] hover:bg-[var(--accent-pink)]/90 neon-glow text-white"
                                : ""
                        )}
                    >
                        {isCreating ? (
                            "Création..."
                        ) : step === totalSteps || (step === 2 && !aiModeEnabled) ? (
                            <>Créer le projet <Sparkles className="w-4 h-4 ml-2" /></>
                        ) : aiModeEnabled && step === 2 ? (
                            <><Sparkles className="w-4 h-4 mr-2" /> Suivant</>
                        ) : (
                            <>Suivant <ChevronRight className="w-4 h-4 ml-2" /></>
                        )}
                    </Button>
                </div>
            </Card>
        </div>
    )
}
