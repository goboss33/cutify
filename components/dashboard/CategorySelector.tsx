"use client"

import { useState, useEffect } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

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

interface CategorySelectorProps {
    onSelect: (preset: CategoryPreset) => void
    onBack: () => void
}

export function CategorySelector({ onSelect, onBack }: CategorySelectorProps) {
    const [presets, setPresets] = useState<CategoryPreset[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                
                const res = await fetch("http://127.0.0.1:8000/api/category-presets", {
                    headers: session?.access_token ? {
                        "Authorization": `Bearer ${session.access_token}`
                    } : {}
                })
                
                if (res.ok) {
                    const data = await res.json()
                    setPresets(data)
                }
            } catch (err) {
                console.error("Failed to fetch category presets", err)
            } finally {
                setLoading(false)
            }
        }
        
        fetchPresets()
    }, [])

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Back Button */}
            <div className="absolute top-8 left-8">
                <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4" /> Retour
                </Button>
            </div>

            {/* Title */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                    Que voulez-vous créer{" "}
                    <span className="neon-text">aujourd'hui</span> ?
                </h1>
                <p className="text-lg text-muted-foreground">
                    Choisissez le type de vidéo pour commencer
                </p>
            </div>

            {/* Category Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-pink)]"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-5xl">
                    {presets.map((preset) => (
                        <div
                            key={preset.id}
                            className="category-card cursor-pointer group"
                            onClick={() => onSelect(preset)}
                        >
                            <div className="flex flex-col items-center p-6 rounded-2xl border-2 border-muted bg-card/50 backdrop-blur-sm hover:bg-card/80">
                                {/* Icon */}
                                <span className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                                    {preset.icon}
                                </span>
                                
                                {/* Name */}
                                <h3 className="text-lg font-bold text-center mb-2 group-hover:text-[var(--accent-pink)] transition-colors">
                                    {preset.name}
                                </h3>
                                
                                {/* Description */}
                                <p className="text-xs text-muted-foreground text-center line-clamp-2">
                                    {preset.description}
                                </p>
                                
                                {/* Default Format Badge */}
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        {preset.default_aspect_ratio}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        {preset.default_duration}s
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
