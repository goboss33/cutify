"use client";

import React, { useState } from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { MOCK_SCENES, Scene } from "@/lib/mockData";
import { useProject } from "@/store/ProjectContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StoryboardGrid } from "./StoryboardGrid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Filter, List, PenTool, Loader2, Camera } from "lucide-react";

export function SceneList() {
    const { currentProject, setScenes } = useProject();
    // If no project selected, show Mock. If project selected, show its scenes (even if empty? ProjectHub handles empty state usually).
    const scenes = currentProject ? (currentProject.scenes || []) : MOCK_SCENES;

    const [generatingScriptIds, setGeneratingScriptIds] = useState<Set<number>>(new Set());
    const [generatingStoryboardIds, setGeneratingStoryboardIds] = useState<Set<number>>(new Set());

    const handleGenerateScript = async (sceneId: number) => {
        if (!currentProject) return;

        setGeneratingScriptIds(prev => new Set(prev).add(sceneId));
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/scenes/${sceneId}/generate-script`, {
                method: "POST"
            });
            if (!response.ok) throw new Error("Failed to generate script");
            const updatedScene = await response.json();

            // Update state
            const updatedScenes = scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
            setScenes(updatedScenes);

        } catch (error) {
            console.error(error);
            alert("Error generating script");
        } finally {
            setGeneratingScriptIds(prev => {
                const next = new Set(prev);
                next.delete(sceneId);
                return next;
            });
        }
    };

    const handleGenerateStoryboard = async (sceneId: number) => {
        if (!currentProject) return;

        setGeneratingStoryboardIds(prev => new Set(prev).add(sceneId));
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/scenes/${sceneId}/generate-storyboard`, {
                method: "POST"
            });
            if (!response.ok) throw new Error("Failed to generate storyboard");
            const updatedScene = await response.json();

            // Update state
            const updatedScenes = scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
            setScenes(updatedScenes);

        } catch (error) {
            console.error(error);
            alert("Error generating storyboard");
        } finally {
            setGeneratingStoryboardIds(prev => {
                const next = new Set(prev);
                next.delete(sceneId);
                return next;
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm z-10">
                <h2 className="text-xl font-bold tracking-tight">Scene List</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" /> Filter
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1">
                <Accordion type="single" collapsible className="w-full p-4 space-y-4">
                    {scenes.map((scene) => (
                        <AccordionItem
                            key={scene.id}
                            value={String(scene.id)}
                            className="border border-border rounded-lg bg-card overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary transition-all"
                        >
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4 w-full text-left">
                                    {/* Status Indicator */}
                                    <div className={cn(
                                        "h-2 w-2 rounded-full shrink-0",
                                        scene.status === 'done' || scene.status === 'storyboarded' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                                            scene.status === 'in-progress' || scene.status === 'scripted' ? "bg-amber-500" :
                                                "bg-neutral-600"
                                    )} />

                                    {/* Title & Stats */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold leading-none mb-1">{scene.title}</h3>
                                        <div className="text-xs text-muted-foreground flex gap-3 font-mono">
                                            <span>{scene.estimated_duration || scene.duration || "N/A"}</span>
                                            <span className={cn(
                                                scene.status === 'done' || scene.status === 'storyboarded' ? "text-green-500" :
                                                    scene.status === 'in-progress' || scene.status === 'scripted' ? "text-amber-500" : ""
                                            )}>
                                                {scene.status === 'storyboarded' ? `Ready [${scene.shots?.length || 0} shots]` :
                                                    scene.status === 'scripted' ? "Scripted" :
                                                        "Pending"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right side thumbnail (visible when collapsed usually, but accordions hide content. We can put a thumb in trigger if we want) */}
                                    <div className="hidden sm:block h-10 w-16 bg-neutral-800 rounded bg-cover bg-center shrink-0 border border-white/10"
                                        style={{ backgroundImage: scene.shots && scene.shots[0] ? `url(${scene.shots[0].image_url?.startsWith('http') ? scene.shots[0].image_url : `http://127.0.0.1:8000${scene.shots[0].image_url}`})` : 'none' }}
                                    />
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 bg-background/50">
                                {/* Internal Layout: Script (Top) -> Storyboard (Bottom) or Split? PRD says Text Area then 3x3 Grid. */}
                                <div className="flex flex-col gap-6 p-6">
                                    {/* Script Editor */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scene Summary / Script</label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 gap-2 text-xs"
                                                disabled={generatingScriptIds.has(scene.id) || !!scene.script}
                                                onClick={() => handleGenerateScript(scene.id)}
                                            >
                                                {generatingScriptIds.has(scene.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenTool className="h-3 w-3" />}
                                                {scene.script ? "Script Generated" : "Write Script with AI"}
                                            </Button>
                                        </div>
                                        <textarea
                                            className="w-full min-h-[150px] bg-neutral-900/50 border border-border rounded-md p-4 text-sm font-mono text-neutral-300 resize-y focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                                            defaultValue={scene.script || scene.summary || ""}
                                            key={scene.script ? 'script' : 'summary'} // Force re-render if switching from summary to script
                                        />
                                    </div>

                                    {/* Storyboard */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storyboard Interpretation</label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 gap-2 text-xs"
                                                disabled={generatingStoryboardIds.has(scene.id) || !scene.script}
                                                onClick={() => handleGenerateStoryboard(scene.id)}
                                            >
                                                {generatingStoryboardIds.has(scene.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                                {scene.shots && scene.shots.length > 0 ? "Regenerate Storyboard" : "Generate Storyboard"}
                                            </Button>
                                            {scene.master_image_url && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 gap-2 text-xs"
                                                    onClick={() => window.open(`http://127.0.0.1:8000${scene.master_image_url}`, '_blank')}
                                                >
                                                    <Filter className="h-3 w-3" /> View Source Grid
                                                </Button>
                                            )}
                                        </div>
                                        <StoryboardGrid scene={scene} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}
