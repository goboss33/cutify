"use client";

import React from "react";
import { useProject } from "@/store/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { SceneList } from "@/components/stage/SceneList";

export function ConceptView() {
    const { currentProject, setCurrentProject } = useProject();

    // Title Editing State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState("");

    const [isSaving, setIsSaving] = useState(false);

    if (!currentProject) return null;

    const handleUpdateProject = async (updates: Partial<typeof currentProject>) => {
        if (!currentProject) return;
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
        <div className="flex flex-col h-full bg-background/50">
            {/* Header Section */}
            <div className="flex flex-col gap-4 text-center items-center pt-8 pb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <Badge variant="outline" className="px-3 py-1 text-sm uppercase tracking-widest text-muted-foreground border-primary/20 bg-primary/5">
                    {currentProject.status || "Concept Phase"}
                </Badge>

                {isEditingTitle ? (
                    <div className="relative flex items-center justify-center max-w-4xl w-full animate-in fade-in zoom-in-95 duration-200">
                        <Textarea
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="text-4xl md:text-5xl font-black tracking-tight text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground shadow-none resize-none overflow-hidden min-h-[1.5em] field-sizing-content w-full px-12"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveTitle();
                                }
                                if (e.key === "Escape") setIsEditingTitle(false);
                            }}
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1 z-10">
                            <Button size="icon" onClick={saveTitle} disabled={isSaving} className="h-10 w-10 rounded-full shadow-lg">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsEditingTitle(false)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center justify-center relative w-full max-w-4xl py-2 px-12 -mx-12 rounded-xl hover:bg-muted/30 transition-colors cursor-text"
                        onClick={() => {
                            setTempTitle(currentProject.title);
                            setIsEditingTitle(true);
                        }}
                    >
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent break-words text-center">
                            {currentProject.title}
                        </h1>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                            <Pencil className="h-4 w-4 text-muted-foreground/50" />
                        </Button>
                    </div>
                )}

                <p className="text-lg text-muted-foreground max-w-2xl">
                    {currentProject.genre ? (
                        <span>A <span className="text-foreground font-medium">{currentProject.genre}</span> production</span>
                    ) : (
                        <span className="italic opacity-50">Defining genre...</span>
                    )}
                </p>
            </div>

            <Separator className="my-4 max-w-4xl mx-auto" />

            {/* Main Content Area - Render SceneList directly */}
            <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 md:px-8 pb-8">
                <SceneList />
            </div>
        </div>
    );
}
