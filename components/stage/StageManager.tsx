"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { SceneList } from "./SceneList";
import { PlayerView } from "./PlayerView";
import { Button } from "@/components/ui/button";
import { LayoutGrid, PlayCircle, List } from "lucide-react";
import { cn } from "@/lib/utils";

import { ProjectHub } from "./ProjectHub";
import { useProject } from "@/store/ProjectContext";


import { ConceptView } from "./ConceptView";
import { FlagFR, FlagUK, FlagES, FlagDE, IconYoutube, IconTikTok } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";

const LANGUAGES: Record<string, any> = {
    "French": { label: "FR", icon: FlagFR },
    "English": { label: "EN", icon: FlagUK },
    "Spanish": { label: "ES", icon: FlagES },
    "German": { label: "DE", icon: FlagDE },
};

export function StageManager() {
    const { stageMode, setStageMode } = useStore();
    const { currentProject, setCurrentProject } = useProject();

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    if (!currentProject) return null;

    const handleUpdateProject = async (updates: Partial<typeof currentProject>) => {
        setIsSaving(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                const updated = await response.json();
                setCurrentProject(updated);
            }
        } catch (e) {
            console.error("Failed to update project", e);
        } finally {
            setIsSaving(false);
        }
    };

    const saveTitle = async () => {
        if (!tempTitle.trim()) return;
        await handleUpdateProject({ title: tempTitle });
        setIsEditingTitle(false);
    };

    return (
        <main className="bg-background h-full flex flex-col relative w-full">
            {/* Stage Navigation / Header Controls */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background z-20 shrink-0 gap-4">
                <div className="flex flex-col items-start gap-1 overflow-hidden flex-1">

                    {/* Editable Title */}
                    <div className="flex items-center gap-2 w-full max-w-xl">
                        {isEditingTitle ? (
                            <div className="relative flex items-center w-full">
                                <Input
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    className="h-8 text-lg font-bold px-2 py-0 bg-muted/50 border-primary/30 focus-visible:ring-primary/50"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") saveTitle();
                                        if (e.key === "Escape") setIsEditingTitle(false);
                                    }}
                                />
                                <div className="absolute right-1 flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-green-500/20 hover:text-green-500" onClick={saveTitle}>
                                        <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive" onClick={() => setIsEditingTitle(false)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="group flex items-center gap-2 cursor-pointer hover:bg-muted/30 px-2 -ml-2 rounded-md py-0.5 transition-colors"
                                onClick={() => {
                                    setTempTitle(currentProject.title);
                                    setIsEditingTitle(true);
                                }}
                            >
                                <span className="font-bold text-lg leading-tight truncate">
                                    {currentProject.title}
                                </span>
                                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {/* Genre & Status */}
                        <span className="font-medium text-foreground/80">{currentProject.genre || "Concept"}</span>
                        <span>•</span>

                        {/* Language */}
                        {/* Language */}
                        <div className="flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded text-[10px]">
                            {LANGUAGES[currentProject.language] ? (() => {
                                const LangIcon = LANGUAGES[currentProject.language].icon;
                                return (
                                    <>
                                        <LangIcon className="w-3 h-2 rounded-[1px]" />
                                        <span className="font-mono">{LANGUAGES[currentProject.language].label}</span>
                                    </>
                                );
                            })() : (
                                <span>{currentProject.language || "FR"}</span>
                            )}
                        </div>

                        {/* Aspect Ratio */}
                        {currentProject.aspect_ratio && (
                            <div className="flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded text-[10px]">
                                {currentProject.aspect_ratio === "16:9" ? (
                                    <IconYoutube className="w-3 h-3 text-red-500/80" />
                                ) : (
                                    <IconTikTok className="w-3 h-3 text-foreground/80" />
                                )}
                                <span className="font-mono">{currentProject.aspect_ratio}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side Controls (View Toggle) */}
                <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border">
                    <Button
                        variant={stageMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setStageMode("list")}
                        className={cn("gap-2 h-8", stageMode === "list" && "bg-background shadow-sm text-foreground")}
                    >
                        <List className="h-4 w-4" /> List
                    </Button>
                    <Button
                        variant={stageMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setStageMode("grid")}
                        className={cn("gap-2 h-8", stageMode === "grid" && "bg-background shadow-sm text-foreground")}
                    >
                        <LayoutGrid className="h-4 w-4" /> Grid
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                        variant={stageMode === "player" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setStageMode("player")}
                        className={cn("gap-2 h-8", stageMode === "player" && "bg-background shadow-sm text-foreground")}
                    >
                        <PlayCircle className="h-4 w-4" /> Player
                    </Button>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 relative overflow-y-auto">
                {/* Main Content */}
                {stageMode === "player" ? (
                    <div className="flex-1 h-full">
                        <PlayerView />
                    </div>
                ) : (
                    <div className="flex-1 h-full">
                        <ConceptView viewMode={stageMode} />
                    </div>
                )}
            </div>
        </main>
    );
}
