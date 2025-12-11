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
import { List, PenTool, Loader2, Camera, GripVertical, Trash2, LayoutGrid, Plus, Filter, Sparkles } from "lucide-react";
import { SceneCard } from "./SceneCard";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function SortableSceneItem({ scene, onGenerateScript, onGenerateStoryboard, generatingScript, generatingStoryboard, onDelete }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scene.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        position: "relative" as "relative", // Fix TS error
    };

    return (
        <div ref={setNodeRef} style={style} className={cn("mb-4", isDragging && "opacity-50")}>
            <AccordionItem
                value={String(scene.id)}
                className="border border-border rounded-lg bg-card overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary transition-all"
            >
                <div className="flex items-center border-b border-border/50">
                    {/* Drag Handle */}
                    <div {...attributes} {...listeners} className="px-3 py-4 cursor-grab hover:text-primary transition-colors text-muted-foreground">
                        <GripVertical className="h-5 w-5" />
                    </div>

                    <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/50 transition-colors flex-1">
                        <div className="flex items-center justify-between w-full flex-1 gap-4">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                {/* Status Indicator */}
                                <div className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    scene.status === 'done' || scene.status === 'storyboarded' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                                        scene.status === 'in-progress' || scene.status === 'scripted' ? "bg-amber-500" :
                                            "bg-neutral-600"
                                )} />

                                {/* Title & Stats */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold leading-none mb-1 truncate">{scene.title}</h3>
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
                            </div>

                            {/* Right side thumbnail - Pushed to right */}
                            <div className="hidden sm:block h-10 w-16 bg-neutral-800 rounded bg-cover bg-center shrink-0 border border-white/10"
                                style={{ backgroundImage: scene.shots && scene.shots[0] ? `url(${scene.shots[0].image_url?.startsWith('http') ? scene.shots[0].image_url : `http://127.0.0.1:8000${scene.shots[0].image_url}`})` : 'none' }}
                            />
                        </div>
                    </AccordionTrigger>

                    {/* Delete Button */}
                    <div className="px-3 border-l border-border/50 flex items-center">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Just prevent accordion, let Dialog open
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Scene?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete "{scene.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(scene.id);
                                        }}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <AccordionContent className="p-0 bg-background/50">
                    <div className="flex flex-col gap-6 p-6">
                        {/* Script Editor */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scene Summary / Script</label>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-2 text-xs"
                                    disabled={generatingScript || !!scene.script}
                                    onClick={() => onGenerateScript(scene.id)}
                                >
                                    {generatingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenTool className="h-3 w-3" />}
                                    {scene.script ? "Script Generated" : "Write Script with AI"}
                                </Button>
                            </div>
                            <textarea
                                className="w-full min-h-[150px] bg-neutral-900/50 border border-border rounded-md p-4 text-sm font-mono text-neutral-300 resize-y focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                                defaultValue={scene.script || scene.summary || ""}
                                key={scene.script ? 'script' : 'summary'}
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
                                    disabled={generatingStoryboard || !scene.script}
                                    onClick={() => onGenerateStoryboard(scene.id)}
                                >
                                    {generatingStoryboard ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                    {scene.shots && scene.shots.length > 0 ? "Regenerate Storyboard" : "Generate Storyboard"}
                                </Button>
                                {scene.master_image_url && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 gap-2 text-xs"
                                        onClick={() => {
                                            const url = scene.master_image_url?.startsWith("http")
                                                ? scene.master_image_url
                                                : `http://127.0.0.1:8000${scene.master_image_url}`;
                                            window.open(url, '_blank');
                                        }}
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
        </div>
    );
}

export function SceneList({ viewMode }: { viewMode: "list" | "grid" }) {
    const { currentProject, setScenes } = useProject();
    const scenes = currentProject ? (currentProject.scenes || []) : MOCK_SCENES;

    const [generatingScriptIds, setGeneratingScriptIds] = useState<Set<number>>(new Set());
    const [generatingStoryboardIds, setGeneratingStoryboardIds] = useState<Set<number>>(new Set());
    const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);

    const gridCols = currentProject?.aspect_ratio === "9:16" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2";

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = scenes.findIndex((s) => s.id === active.id);
            const newIndex = scenes.findIndex((s) => s.id === over?.id);

            const newScenes = arrayMove(scenes, oldIndex, newIndex);

            // Optimistic update
            setScenes(newScenes);

            // Backend Update
            if (currentProject?.id) {
                const orderedIds = newScenes.map(s => s.id);
                try {
                    await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/scenes/reorder`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ordered_ids: orderedIds })
                    });
                } catch (e) {
                    console.error("Reorder failed", e);
                }
            }
        }
    };

    const handleDeleteScene = async (sceneId: number) => {
        if (!currentProject?.id) return;

        // Optimistic delete
        const newScenes = scenes.filter(s => s.id !== sceneId);
        setScenes(newScenes);

        try {
            await fetch(`http://127.0.0.1:8000/api/scenes/${sceneId}`, { method: "DELETE" });
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete scene");
        }
    };

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

    const handleAutoGenerateScenes = async () => {
        if (!currentProject?.id) return;
        setIsGeneratingScenes(true);
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/generate-scenes`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to generate scenes");
            const newScenes = await res.json();

            // Append new scenes to existing ones or set them
            // The backend returns the newly created scenes.
            // If we want to fully refresh, we might want to refetch or just append.
            // Let's assume we want to see them immediately.
            setScenes([...scenes, ...newScenes]);

        } catch (e) {
            console.error("Error generating scenes", e);
            alert("Failed to auto-generate scenes");
        } finally {
            setIsGeneratingScenes(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <div className="flex-1 overflow-auto p-4 md:p-6">
                {viewMode === "list" ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={scenes.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <Accordion type="single" collapsible className="space-y-4 max-w-4xl mx-auto pb-20">
                                {scenes.map((scene) => (
                                    <SortableSceneItem
                                        key={scene.id}
                                        scene={scene}
                                        onGenerateScript={handleGenerateScript}
                                        onGenerateStoryboard={handleGenerateStoryboard}
                                        generatingScript={generatingScriptIds.has(scene.id)}
                                        generatingStoryboard={generatingStoryboardIds.has(scene.id)}
                                        onDelete={handleDeleteScene}
                                    />
                                ))}
                            </Accordion>
                        </SortableContext>
                    </DndContext>
                ) : (
                    /* Grid View */
                    <div className={cn("grid gap-8 auto-rows-min pb-20", gridCols)}>
                        {scenes.map((scene) => (
                            <SceneCard
                                key={scene.id}
                                scene={scene}
                                aspectRatio={currentProject?.aspect_ratio || "16:9"}
                                onGenerateScript={handleGenerateScript}
                                onGenerateStoryboard={handleGenerateStoryboard}
                                onDelete={handleDeleteScene}
                                generatingScript={generatingScriptIds.has(scene.id)}
                                generatingStoryboard={generatingStoryboardIds.has(scene.id)}
                            />
                        ))}
                    </div>
                )}

                {/* Empty State / Add Buttons */}
                <div className="max-w-4xl mx-auto mt-8 flex flex-col items-center gap-4 pb-20">
                    {scenes.length === 0 && (
                        <div className="text-center space-y-4 py-8">
                            <h3 className="text-lg font-medium text-muted-foreground">No scenes yet</h3>
                            <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
                                You can add scenes manually or let the AI structure the video for you based on the project details.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            size="lg"
                            className="w-full md:w-auto border-dashed hover:border-solid hover:bg-muted/50"
                            onClick={async () => {
                                if (!currentProject?.id) return;
                                try {
                                    const res = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/scenes/simple`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ title: `Scene ${scenes.length + 1}` })
                                    });
                                    if (res.ok) {
                                        const newScene = await res.json();
                                        setScenes([...scenes, newScene]);
                                    }
                                } catch (e) {
                                    console.error("Add scene failed", e);
                                }
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add New Scene
                        </Button>

                        <Button
                            variant="default" // "magic" variant if we had one
                            size="lg"
                            className="w-full md:w-auto shadow-lg shadow-primary/20"
                            onClick={handleAutoGenerateScenes}
                            disabled={isGeneratingScenes}
                        >
                            {isGeneratingScenes ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating Structure...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2" /> Auto-Generate Scenes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
