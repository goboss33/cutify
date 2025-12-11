"use client"

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
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
import { ChevronRight, ChevronLeft, Sparkles, Film, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProjectCreated: (project: any) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onProjectCreated }: CreateProjectDialogProps) {
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
            handleClose();
        } catch (e) {
            console.error(e);
            alert("Error creating project");
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset after strict timeout to allow dialog fade out
        setTimeout(() => {
            setStep(1);
            setTitle("");
            setGenre("");
            setPitch("");
            setTargetAudience("");
            setVisualStyle("");
            setAspectRatio("16:9");
        }, 300);
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                    <div className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all duration-300",
                        step === s ? "bg-primary scale-125" : step > s ? "bg-primary/50" : "bg-muted"
                    )} />
                    {s < 3 && <div className={cn("w-12 h-0.5 mx-2 rounded-full", step > s ? "bg-primary/20" : "bg-muted/50")} />}
                </div>
            ))}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl bg-card">

                {/* Header Graphic */}
                <div className="bg-muted/30 p-6 pb-2 border-b border-border/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                    <DialogTitle className="text-2xl font-bold tracking-tight mb-2">Let's Create Something</DialogTitle>
                    <DialogDescription className="text-muted-foreground/80 max-w-sm mx-auto mb-6">
                        Follow these steps to set up the perfect foundation for your new video project.
                    </DialogDescription>
                    {renderStepIndicator()}
                </div>

                <div className="flex-1 overflow-y-auto px-8 pt-6 pb-4">


                    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 transform" key={step}>
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-400" />
                                        The Concept
                                    </h3>
                                    <p className="text-sm text-muted-foreground">What's the big idea?</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Project Title</label>
                                        <Input
                                            placeholder="The next big thing..."
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            className="h-12 text-lg"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Genre</label>
                                        <GenreSelector value={genre} onChange={setGenre} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Pitch / Key Ideas</label>
                                        <Textarea
                                            placeholder="E.g. A fast-paced travel vlog exploring Tokyo's hidden gems..."
                                            value={pitch}
                                            onChange={e => setPitch(e.target.value)}
                                            className="h-24 resize-none bg-muted/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                                        <Film className="w-5 h-5 text-purple-400" />
                                        Audience & Style
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Who is watching and how does it look?</p>
                                </div>
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Target Audience</label>
                                        <Select value={targetAudience} onValueChange={setTargetAudience}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Select audience..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TARGET_AUDIENCES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Visual Style</label>
                                        <Select value={visualStyle} onValueChange={setVisualStyle}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="Select a style..." />
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
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                                        <Settings2 className="w-5 h-5 text-blue-400" />
                                        Format & Specs
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Technical details for distribution.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        className={`flex flex-col items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${aspectRatio === "16:9" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
                                        onClick={() => setAspectRatio("16:9")}
                                    >
                                        <IconYoutube className={cn("w-8 h-8", aspectRatio === "16:9" ? "text-red-600" : "text-muted-foreground")} />
                                        <div className="text-center">
                                            <span className="block text-sm font-semibold">Landscape</span>
                                            <span className="text-xs text-muted-foreground">16:9 YouTube</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex flex-col items-center gap-3 cursor-pointer p-4 rounded-xl border-2 transition-all ${aspectRatio === "9:16" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"}`}
                                        onClick={() => setAspectRatio("9:16")}
                                    >
                                        <IconTikTok className={cn("w-8 h-8", aspectRatio === "9:16" ? "text-foreground" : "text-muted-foreground")} />
                                        <div className="text-center">
                                            <span className="block text-sm font-semibold">Portrait</span>
                                            <span className="text-xs text-muted-foreground">9:16 TikTok</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Language</label>
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger className="h-11">
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
                                            <label className="text-sm font-medium">Approx. Duration</label>
                                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                                {durationSeconds[0] < 60 ? `${durationSeconds[0]}s` : `${Math.floor(durationSeconds[0] / 60)} mins`}
                                            </span>
                                        </div>
                                        <Slider
                                            value={durationSeconds}
                                            onValueChange={setDurationSeconds}
                                            max={180}
                                            min={10}
                                            step={10}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-border/50 bg-muted/20">
                    <div className="flex w-full justify-between items-center">
                        <Button
                            variant="ghost"
                            onClick={step === 1 ? handleClose : prevStep}
                            disabled={isCreating}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {step === 1 ? "Cancel" : "Back"}
                        </Button>

                        <div className="flex gap-2">
                            {step < totalSteps ? (
                                <Button onClick={nextStep} disabled={!title || !genre} className="gap-2">
                                    Next Step <ChevronRight className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button onClick={handleCreate} disabled={isCreating} className="gap-2 min-w-[120px]">
                                    {isCreating ? (
                                        <>Creating...</>
                                    ) : (
                                        <>Create Project <Sparkles className="w-4 h-4" /></>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
