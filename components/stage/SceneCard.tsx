"use client";

import React, { useState } from "react";
import { Scene } from "@/lib/mockData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Repeat, PenTool, Camera, Trash2, Loader2, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SceneCardProps {
    scene: Scene;
    aspectRatio: string; // "16:9" or "9:16"
    onGenerateScript: (id: number) => void;
    onGenerateStoryboard: (id: number) => void;
    onDelete: (id: number) => void;
    generatingScript: boolean;
    generatingStoryboard: boolean;
}

export function SceneCard({
    scene,
    aspectRatio,
    onGenerateScript,
    onGenerateStoryboard,
    onDelete,
    generatingScript,
    generatingStoryboard
}: SceneCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    // Dynamic aspect ratio class for the card container
    const aspectRatioClass = aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]";

    const getThumbnailUrl = () => {
        if (scene.shots && scene.shots.length > 0) {
            const url = scene.shots[0].image_url;
            return url?.startsWith('http') ? url : `http://127.0.0.1:8000${url}`;
        }
        return null;
    };

    const thumbnailUrl = getThumbnailUrl();

    return (
        <div className={cn("relative group perspective-1000 w-full", aspectRatioClass)}>
            <div
                className={cn(
                    "relative w-full h-full transition-all duration-500 transform-style-3d shadow-lg rounded-xl border border-border/50",
                    isFlipped ? "rotate-y-180" : ""
                )}
            >
                {/* FRONT (RECTO) */}
                <div className="absolute inset-0 w-full h-full backface-hidden bg-card rounded-xl overflow-hidden flex flex-col border border-white/20">
                    {/* Thumbnail Background */}
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none' }}
                    >
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />
                    </div>

                    {/* Content Overlay */}
                    <div className="absolute inset-0 p-4 flex flex-col justify-between z-10 w-full">
                        <div className="flex justify-between items-start w-full">
                            <Badge variant="secondary" className="bg-black/50 backdrop-blur-md border-white/10 text-white shadow-xs">
                                {scene.id}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-white/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFlipped(true);
                                }}
                            >
                                <Repeat className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-1 w-full translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                                {scene.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-white/70">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider text-[10px]",
                                    scene.status === 'done' ? "bg-green-500/20 text-green-400" :
                                        scene.status === 'scripted' ? "bg-amber-500/20 text-amber-400" :
                                            "bg-white/10 text-white/50"
                                )}>
                                    {scene.status === 'done' ? 'Ready' : scene.status || 'Draft'}
                                </span>
                                <span>•</span>
                                <span>{scene.estimated_duration || "0s"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BACK (VERSO) */}
                <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-neutral-900 rounded-xl overflow-hidden flex flex-col border border-border">
                    <div className="p-4 flex flex-col h-full gap-4">
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">Scene Details</h4>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => onDelete(scene.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-muted text-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsFlipped(false);
                                    }}
                                >
                                    <Repeat className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1">
                            <p className="text-sm text-foreground/80 leading-relaxed font-mono">
                                {scene.script || scene.summary || "No script yet..."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2 text-xs"
                                onClick={() => onGenerateScript(scene.id)}
                                disabled={generatingScript}
                            >
                                {generatingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenTool className="w-3 h-3" />}
                                Script
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2 text-xs"
                                onClick={() => onGenerateStoryboard(scene.id)}
                                disabled={generatingStoryboard}
                            >
                                {generatingStoryboard ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                                Storyboard
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
