
import React from 'react';
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssetSidebar() {
    const { activeSceneId, toggleScene } = useStore();
    const { currentProject } = useProject();

    if (!activeSceneId || !currentProject) return null;

    // Find the active scene object
    // activeSceneId is string in store, but IDs are numbers in mockData/DB
    // We should safely compare
    const activeScene = currentProject.scenes?.find(s => String(s.id) === String(activeSceneId));

    if (!activeScene) return null;

    return (
        <div className="absolute left-0 top-0 h-full w-[320px] bg-background/95 backdrop-blur-sm border-r border-border flex flex-col animate-in slide-in-from-left-4 duration-300 z-50 shadow-xl">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted/20">
                <span className="font-semibold text-sm truncate max-w-[200px]" title={activeScene.title}>
                    {activeScene.title}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-foreground"
                    onClick={() => toggleScene(activeSceneId)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* ContentTabs */}
            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="characters" className="w-full h-full flex flex-col">
                    <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-10">
                        <TabsTrigger
                            value="characters"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/10 h-10 gap-2"
                        >
                            <Users className="h-4 w-4" /> Characters
                        </TabsTrigger>
                        <TabsTrigger
                            value="locations"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/10 h-10 gap-2"
                        >
                            <MapPin className="h-4 w-4" /> Location
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto p-4">
                        <TabsContent value="characters" className="m-0 space-y-4">
                            <div className="text-sm text-neutral-400 text-center py-8 border-2 border-dashed border-neutral-800 rounded-lg">
                                {/* Placeholder for character management */}
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p>No characters assigned</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="locations" className="m-0 space-y-4">
                            <div className="text-sm text-neutral-400 text-center py-8 border-2 border-dashed border-neutral-800 rounded-lg">
                                {/* Placeholder for location management */}
                                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p>No location set</p>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
