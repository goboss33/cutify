"use client";

import React from "react";
import { useProject } from "@/store/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";

export function ConceptView() {
    const { currentProject, setCurrentProject } = useProject();
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    if (!currentProject) return null;

    const handleSave = async () => {
        if (!currentProject || !tempTitle.trim()) return;
        setIsSaving(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/projects/${currentProject.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: tempTitle })
            });
            if (response.ok) {
                const updated = await response.json();
                setCurrentProject(updated);
                setIsEditing(false);
            }
        } catch (e) {
            console.error("Failed to update title", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-4 text-center items-center">
                <Badge variant="outline" className="px-3 py-1 text-sm uppercase tracking-widest text-muted-foreground border-primary/20 bg-primary/5">
                    {currentProject.status || "Concept Phase"}
                </Badge>

                {isEditing ? (
                    <div className="relative flex items-center justify-center max-w-4xl w-full animate-in fade-in zoom-in-95 duration-200">
                        <Textarea
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="text-4xl md:text-5xl font-black tracking-tight text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground shadow-none resize-none overflow-hidden min-h-[1.5em] field-sizing-content w-full px-12"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault(); // Prevent newline
                                    handleSave();
                                }
                                if (e.key === "Escape") setIsEditing(false);
                            }}
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1 z-10">
                            <Button size="icon" onClick={handleSave} disabled={isSaving} className="h-10 w-10 rounded-full shadow-lg">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="group flex items-center justify-center relative w-full max-w-4xl py-2 px-12 -mx-12 rounded-xl hover:bg-muted/30 transition-colors cursor-text"
                        onClick={() => {
                            setTempTitle(currentProject.title);
                            setIsEditing(true);
                        }}
                    >
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent break-words text-center">
                            {currentProject.title}
                        </h1>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                        >
                            <Pencil className="h-4 w-4 text-muted-foreground/50" />
                        </Button>
                    </div>
                )}
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
