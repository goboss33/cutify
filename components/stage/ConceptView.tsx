"use client";

import React from "react";
import { useProject } from "@/store/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function ConceptView() {
    const { currentProject } = useProject();

    if (!currentProject) return null;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-4 text-center items-center">
                <Badge variant="outline" className="px-3 py-1 text-sm uppercase tracking-widest text-muted-foreground border-primary/20 bg-primary/5">
                    {currentProject.status || "Concept Phase"}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                    {currentProject.title}
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    {currentProject.genre ? (
                        <span>A <span className="text-foreground font-medium">{currentProject.genre}</span> production</span>
                    ) : (
                        <span className="italic opacity-50">Defining genre...</span>
                    )}
                </p>
            </div>

            <Separator className="my-8" />

            {/* Core Concept Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-muted/30 border-muted-foreground/10 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            📣 The Pitch
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {currentProject.pitch ? (
                            <p className="leading-relaxed text-muted-foreground">
                                {currentProject.pitch}
                            </p>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 opacity-50">
                                <p>No pitch defined yet.</p>
                                <p className="text-xs">Tell the agent your idea to get started!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="bg-muted/30 border-muted-foreground/10 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="text-base">Target Audience</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {currentProject.target_audience ? (
                                <p className="text-sm text-muted-foreground">{currentProject.target_audience}</p>
                            ) : (
                                <span className="text-sm text-muted-foreground/50 italic">Who is this for?</span>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/30 border-muted-foreground/10 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader>
                            <CardTitle className="text-base">Visual Style</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {currentProject.visual_style ? (
                                <p className="text-sm text-muted-foreground">{currentProject.visual_style}</p>
                            ) : (
                                <span className="text-sm text-muted-foreground/50 italic">Cinematic? Cartoon? Noir?</span>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
