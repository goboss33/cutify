"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { SceneList } from "./SceneList";
import { PlayerView } from "./PlayerView";
import { Button } from "@/components/ui/button";
import { LayoutGrid, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { ProjectHub } from "./ProjectHub";
import { useProject } from "@/store/ProjectContext";


import { ConceptView } from "./ConceptView";

export function StageManager() {
    const { isPlayerMode, setPlayerMode } = useStore();
    const { currentProject } = useProject();


    if (!currentProject) return null;

    return (
        <main className="bg-background h-full flex flex-col relative w-full">
            {/* Stage Navigation / Header Controls */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background z-20 shrink-0">
                <div className="font-semibold text-lg">
                    Project Workspace
                </div>

                {/* Right Side Controls (Player Toggle) */}
                <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border">
                    <Button
                        variant={!isPlayerMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setPlayerMode(false)}
                        className={cn("gap-2 h-8", !isPlayerMode && "bg-background shadow-sm text-foreground")}
                    >
                        <LayoutGrid className="h-4 w-4" /> Board
                    </Button>
                    <Button
                        variant={isPlayerMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setPlayerMode(true)}
                        className={cn("gap-2 h-8", isPlayerMode && "bg-background shadow-sm text-foreground")}
                    >
                        <PlayCircle className="h-4 w-4" /> Player
                    </Button>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 relative overflow-y-auto">
                <div className="flex flex-col min-h-full">

                    {/* Concept Header Section */}
                    {/* We conditionally hide concept/scenes if player mode is active? 
                        User asked to integrate concept into scene. 
                        Usually Player Mode takes over the whole screen or center stage.
                        Let's keep Concept visible in 'Board' mode, maybe hide in 'Player' mode to give space?
                        For now, let's stack them in Board mode.
                    */}

                    {!isPlayerMode && (
                        <div className="border-b border-border/50 bg-muted/10">
                            <ConceptView />
                        </div>
                    )}

                    {/* Scene List or Player */}
                    <div className="flex-1">
                        {isPlayerMode ? <PlayerView /> : <SceneList />}
                    </div>
                </div>
            </div>
        </main>
    );
}
