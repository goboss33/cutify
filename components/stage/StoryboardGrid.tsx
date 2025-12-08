import React from "react";
import { Scene, Shot } from "@/lib/mockData";
import { Card } from "@/components/ui/card";
import { MoreHorizontal, RefreshCw, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StoryboardGridProps {
    scene: Scene;
}

export function StoryboardGrid({ scene }: StoryboardGridProps) {
    // Ensure we display 9 cells (3x3) even if shots are fewer
    const shots = scene.shots || [];
    const displayShots = Array.from({ length: 9 }).map((_, i) => shots[i] || null);

    return (
        <div className="grid grid-cols-3 gap-3 p-1">
            {displayShots.map((shot, i) => (
                <Card
                    key={i}
                    className="aspect-[16/9] relative group overflow-hidden bg-neutral-900 border-neutral-800 hover:border-primary/50 transition-colors"
                >
                    {shot ? (
                        <>
                            {/* Image */}
                            {shot.status === 'generating' ? (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                                        <span className="text-xs text-muted-foreground">Generating...</span>
                                    </div>
                                </div>
                            ) : (
                                <img
                                    src={shot.image_url || shot.thumbnail || "https://placehold.co/600x400/1a1a1a/FFF?text=No+Image"}
                                    alt={shot.label || `Shot ${shot.shot_number}`}
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                            )}

                            {/* Label */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs truncate border-t border-white/10 backdrop-blur-sm">
                                <span className="font-medium">{shot.label || `Shot ${shot.shot_number}`}</span>
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                <Button size="icon" variant="secondary" className="h-6 w-6 rounded-md shadow-md">
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-6 w-6 rounded-md shadow-md">
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600">
                            <span className="text-xs uppercase font-bold tracking-wider opacity-50">Empty</span>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
}
