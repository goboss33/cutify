"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GenreSelector } from "@/components/dashboard/GenreSelector";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { FlagFR, FlagUK, FlagES, FlagDE, IconYoutube, IconTikTok } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft, Sparkles, Film, Settings2, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const LANGUAGES = [
    { code: "French", label: "French", icon: FlagFR },
    { code: "English", label: "English", icon: FlagUK },
    { code: "Spanish", label: "Spanish", icon: FlagES },
    { code: "German", label: "German", icon: FlagDE },
];

const TARGET_AUDIENCES = [
    "General Audience", "Kids & Family", "Teens", "Young Adults",
    "Professionals", "Tech Enthusiasts", "Gamers", "Lifestyle"
];

const VISUAL_STYLES = [
    "Cinematic", "Minimalist", "Vlog / Handheld", "Documentary",
    "Animation / 3D", "Retro / Vintage", "Cyberpunk / Futuristic", "Corporate / Clean"
];

interface CreateProjectWizardProps {
    onCancel: () => void;
    onProjectCreated: (project: any) => void;
}

export function CreateProjectWizard({ onCancel, onProjectCreated }: CreateProjectWizardProps) {
    const [step, setStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);

    // Form Data
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [pitch, setPitch] = useState("");
    const [targetAudience, setTargetAudience] = useState("");
    const [visualStyle, setVisualStyle] = useState("");
    const [language, setLanguage] = useState("French");
    const [durationSeconds, setDurationSeconds] = useState([60]);
    const [aspectRatio, setAspectRatio] = useState("16:9");

    const totalSteps = 3;

    const handleCreate = async () => {
        if (!title || !genre) return;

        setIsCreating(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const durationStr = durationSeconds[0] < 60
                ? `${durationSeconds[0]}s`
                : `${Math.floor(durationSeconds[0] / 60)} min${Math.floor(durationSeconds[0] / 60) > 1 ? 's' : ''}`;

            const res = await fetch("http://127.0.0.1:8000/api/projects", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    genre,
                    language,
                    target_duration: durationStr,
                    aspect_ratio: aspectRatio,
                    pitch,
                    target_audience: targetAudience,
                    visual_style: visualStyle
                })
            });

            if (!res.ok) throw new Error("Failed to create project");

            const newProject = await res.json();
            onProjectCreated(newProject);
        } catch (e) {
            console.error(e);
            alert("Error creating project");
        } finally {
            setIsCreating(false);
        }
    };

    const handleQuickStart = async () => {
        setIsCreating(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch("http://127.0.0.1:8000/api/projects", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: "Untitled Project",
                    genre: "General",
                    language: "French",
                    target_duration: "60s",
                    aspect_ratio: "16:9",
                    pitch: "Quick start project",
                    target_audience: "General Audience",
                    visual_style: "Cinematic"
                })
            });

            if (!res.ok) throw new Error("Failed to create project");

            const newProject = await res.json();
            onProjectCreated(newProject);
        } catch (e) {
            console.error(e);
            alert("Error creating project");
        } finally {
            setIsCreating(false);
        }
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="w-full max-w-5xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-8">
                <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground" onClick={onCancel}>
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Button>
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={cn(
                                "w-3 h-3 rounded-full transition-all duration-300 ring-2 ring-offset-2 ring-offset-background",
                                step === s ? "bg-primary ring-primary" : step > s ? "bg-primary ring-primary" : "bg-muted ring-transparent"
                            )} />
                            {s < 3 && <div className={cn("w-12 h-0.5 mx-2 rounded-full transition-colors duration-300", step > s ? "bg-primary" : "bg-muted")} />}
                        </div>
                    ))}
                </div>
                {/* Quick Start Button */}
                <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground hover:text-primary transition-colors"
                    onClick={handleQuickStart}
                    disabled={isCreating}
                >
                    <Sparkles className="w-4 h-4" /> Skip & Quick Start
                </Button>
            </div>

            <div className="flex-1 flex gap-8 items-start">

                {/* Left Side: Context / Preview / Info */}
                <div className="hidden lg:flex w-1/3 flex-col gap-6 sticky top-0">
                    <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
                        <h2 className="text-3xl font-black tracking-tight mb-4">
                            {step === 1 && "Start with a Vision"}
                            {step === 2 && "Define the Vibe"}
                            {step === 3 && "Technical Specs"}
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {step === 1 && "Every great video starts with a spark. Give us a title and the core idea, and we'll help you flesh it out."}
                            {step === 2 && "Who are you talking to? What should they feel? The right tone makes all the difference."}
                            {step === 3 && "Let's get the logistics down. Format, language, and duration to fit your distribution channel."}
                        </p>
                    </div>

                    {/* Live Preview Card */}
                    <Card className="p-4 border-2 border-dashed bg-card/50 opacity-80 backdrop-blur-sm">
                        <div className="aspect-video w-full bg-muted rounded-lg mb-4 relative overflow-hidden flex items-center justify-center">
                            <div className={`absolute inset-0 opacity-20 bg-linear-to-br from-primary to-purple-500 transition-all duration-700`} style={{ filter: `hue-rotate(${step * 45}deg)` }} />
                            <Film className="w-12 h-12 text-muted-foreground/30" />
                            {aspectRatio === "9:16" && (
                                <div className="absolute inset-y-2 inset-x-[30%] border-2 border-primary/30 rounded-md" />
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="h-6 w-3/4 bg-primary/10 rounded animate-pulse" style={{ animationDuration: '2s' }}>
                                {title && <span className="text-sm font-bold text-foreground block px-1">{title}</span>}
                            </div>
                            <div className="h-4 w-1/2 bg-muted rounded" />
                        </div>
                    </Card>
                </div>

                {/* Right Side: Form Wizard */}
                <Card className="flex-1 p-8 shadow-2xl border-primary/10 bg-card rounded-3xl min-h-[500px] flex flex-col justify-between relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="relative">
                        {step === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-lg font-semibold">Project Title</label>
                                        <Input
                                            placeholder="The next big thing..."
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            className="h-14 text-xl bg-muted/30 border-primary/20 focus-visible:ring-primary/30"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-lg font-semibold">Genre</label>
                                        <GenreSelector value={genre} onChange={setGenre} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-lg font-semibold">Pitch / Key Ideas</label>
                                        <Textarea
                                            placeholder="Type your rough ideas here..."
                                            value={pitch}
                                            onChange={e => setPitch(e.target.value)}
                                            className="h-32 resize-none bg-muted/30 border-primary/20 text-base leading-relaxed focus-visible:ring-primary/30"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="grid gap-8">
                                    <div className="space-y-3">
                                        <label className="text-lg font-semibold flex items-center gap-2">
                                            Target Audience
                                        </label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {TARGET_AUDIENCES.map(a => (
                                                <div
                                                    key={a}
                                                    onClick={() => setTargetAudience(a)}
                                                    className={cn(
                                                        "cursor-pointer p-4 rounded-xl border-2 text-center text-sm font-medium transition-all hover:border-primary/50 hover:bg-primary/5",
                                                        targetAudience === a ? "border-primary bg-primary/10 text-primary" : "border-muted bg-card"
                                                    )}
                                                >
                                                    {a}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-lg font-semibold">Visual Style</label>
                                        <Select value={visualStyle} onValueChange={setVisualStyle}>
                                            <SelectTrigger className="h-14 text-lg bg-muted/30 border-primary/20">
                                                <SelectValue placeholder="Select a visual vibe..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VISUAL_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="grid gap-8">
                                    <div className="space-y-3">
                                        <label className="text-lg font-semibold">Target Platform</label>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div
                                                className={cn(
                                                    "flex flex-col items-center gap-4 cursor-pointer p-8 rounded-2xl border-2 transition-all hover:scale-[1.02]",
                                                    aspectRatio === "16:9" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-muted hover:border-foreground/20"
                                                )}
                                                onClick={() => setAspectRatio("16:9")}
                                            >
                                                <IconYoutube className={cn("w-12 h-12", aspectRatio === "16:9" ? "text-red-600" : "text-muted-foreground")} />
                                                <div className="text-center">
                                                    <span className="block text-xl font-bold">YouTube</span>
                                                    <span className="text-sm text-muted-foreground">Landscape 16:9</span>
                                                </div>
                                            </div>
                                            <div
                                                className={cn(
                                                    "flex flex-col items-center gap-4 cursor-pointer p-8 rounded-2xl border-2 transition-all hover:scale-[1.02]",
                                                    aspectRatio === "9:16" ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-muted hover:border-foreground/20"
                                                )}
                                                onClick={() => setAspectRatio("9:16")}
                                            >
                                                <IconTikTok className={cn("w-12 h-12", aspectRatio === "9:16" ? "text-foreground" : "text-muted-foreground")} />
                                                <div className="text-center">
                                                    <span className="block text-xl font-bold">TikTok / Shorts</span>
                                                    <span className="text-sm text-muted-foreground">Portrait 9:16</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-lg font-semibold">Language</label>
                                            <Select value={language} onValueChange={setLanguage}>
                                                <SelectTrigger className="h-12 bg-muted/30 border-primary/20">
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

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-lg font-semibold">Duration estimate</label>
                                                <span className="text-sm font-mono bg-primary/10 text-primary px-3 py-1 rounded-full">
                                                    {durationSeconds[0] < 60 ? `${durationSeconds[0]}s` : `${Math.floor(durationSeconds[0] / 60)} mins`}
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
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-8 mt-4 border-t border-border/50">
                        {step > 1 ? (
                            <Button variant="outline" onClick={prevStep} size="lg" className="px-8">
                                <ChevronLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                        ) : (
                            <div />
                        )}

                        {step < totalSteps ? (
                            <Button onClick={nextStep} disabled={!title || !genre} size="lg" className="px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                                Continue <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleCreate} disabled={isCreating} size="lg" className="px-10 text-base shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105">
                                {isCreating ? (
                                    <>Creating...</>
                                ) : (
                                    <>Create Magic <Sparkles className="w-4 h-4 ml-2" /></>
                                )}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
