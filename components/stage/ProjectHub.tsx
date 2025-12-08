"use client";

import React from 'react';
import { useProject } from '@/store/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, Clapperboard } from "lucide-react";

export function ProjectHub() {
    const { currentProject, setScenes } = useProject();
    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleGenerateScenes = async () => {
        if (!currentProject) return;
        setIsGenerating(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}/generate-scenes`, {
                method: "POST"
            });
            if (!response.ok) throw new Error("Failed to generate scenes");
            const scenes = await response.json();
            setScenes(scenes);
        } catch (error) {
            console.error(error);
            alert("Error generating scenes");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!currentProject) return null;

    return (
        <div className="h-full w-full bg-background p-6">
            <div className="flex flex-col space-y-6 h-full max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">{currentProject.title}</h1>
                        <p className="text-muted-foreground">Project Overview</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleGenerateScenes}
                            disabled={isGenerating}
                            className="gap-2"
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                            Generate Scenes Breakdown
                        </Button>
                        <Badge variant={currentProject.status === 'concept' ? 'secondary' : 'default'} className="uppercase text-sm px-3 py-1 self-center">
                            {currentProject.status}
                        </Badge>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">

                    {/* Main Pitch Card - Takes up 2/3 width */}
                    <Card className="md:col-span-2 flex flex-col">
                        <CardHeader className="bg-muted/30 pb-2">
                            <CardTitle className="text-lg font-medium">Pitch / Logline</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 pt-4">
                            <ScrollArea className="h-full w-full max-h-[300px]">
                                <p className="leading-relaxed whitespace-pre-wrap text-lg">{currentProject.pitch}</p>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Details Card - Takes up 1/3 width */}
                    <Card className="flex flex-col">
                        <CardHeader className="bg-muted/30 pb-2">
                            <CardTitle className="text-lg font-medium">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground mb-1">Genre</h3>
                                <p className="text-muted-foreground">{currentProject.genre || "N/A"}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-foreground mb-1">Target Audience</h3>
                                <p className="text-muted-foreground">{currentProject.target_audience || "N/A"}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-foreground mb-1">Created At</h3>
                                <p className="text-muted-foreground text-xs">{currentProject.created_at ? new Date(currentProject.created_at).toLocaleString() : "Just now"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Visual Style Card - Full width */}
                    <Card className="md:col-span-3">
                        <CardHeader className="bg-muted/30 pb-2">
                            <CardTitle className="text-lg font-medium">Visual Style</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{currentProject.visual_style}</p>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
