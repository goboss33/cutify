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

export function StageManager() {
    const { isPlayerMode, setPlayerMode } = useStore();
    const { currentProject } = useProject();

    // Show ProjectHub only if we have a project but no scenes yet (Concept Phase)
    if (currentProject && (!currentProject.scenes || currentProject.scenes.length === 0)) {
        return <ProjectHub />;
    }

    return (
        <main className="bg-background h-full flex flex-col relative">
            {/* Mode Switcher (Floating or Fixed header?) PRD says "Stage & Scene Manager ... toggled by a button" */}
            {/* I'll put it in a top bar or overlay. Let's put it in a top bar combined with breadcrumbs or just a floater. 
          PRD Image 1 shows a "Vue Liste des Scenes" title and maybe controls.
          I'll add a header bar for the Stage. 
       */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background z-20 shrink-0">
                <div className="flex items-center gap-2">
                    <h1 className="font-semibold text-lg tracking-tight">
                        {isPlayerMode ? "Studio Monitor" : "Scene Board"}
                    </h1>
                </div>

                <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border">
                    <Button
                        variant={!isPlayerMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setPlayerMode(false)}
                        className={cn("gap-2 h-8", !isPlayerMode && "bg-background shadow-sm text-foreground")}
                    >
                        <LayoutGrid className="h-4 w-4" /> Scenes
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

            {/* Content Area */}
            <div className="flex-1 relative">
                {isPlayerMode ? <PlayerView /> : <SceneList />}
            </div>
        </main>
    );
}
