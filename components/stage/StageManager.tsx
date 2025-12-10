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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConceptView } from "./ConceptView";

export function StageManager() {
    const { isPlayerMode, setPlayerMode } = useStore();
    const { currentProject } = useProject();
    const [activeStageTab, setActiveStageTab] = React.useState("concept");

    // Auto-switch to Concept tab if project is brand new (status=concept) and we are just loading?
    // Actually default "concept" is fine.

    if (!currentProject) return null;

    return (
        <main className="bg-background h-full flex flex-col relative w-full">
            {/* Stage Navigation Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background z-20 shrink-0">
                <Tabs value={activeStageTab} onValueChange={setActiveStageTab} className="h-full flex items-center">
                    <TabsList className="bg-transparent p-0 gap-6">
                        <TabsTrigger
                            value="concept"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-2"
                        >
                            Concept
                        </TabsTrigger>
                        <TabsTrigger
                            value="scenes"
                            className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-14 px-2"
                        >
                            Scenes
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Right Side Controls (Player Toggle) - Only visible in Scenes tab */}
                {activeStageTab === "scenes" && (
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
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden">
                {activeStageTab === "concept" && (
                    <div className="h-full overflow-y-auto">
                        <ConceptView />
                    </div>
                )}

                {activeStageTab === "scenes" && (
                    isPlayerMode ? <PlayerView /> : <SceneList />
                )}
            </div>
        </main>
    );
}
