"use client";

import React from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { MOCK_SCENES, Scene } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge"; // Using badge styled div if badge not installed, but standard Shadcn usually has it. wait, I didn't install badge. I'll make a custom one.
import { Textarea } from "@/components/ui/textarea"; // Didn't install textarea. I'll use standard textarea or install. Standard for now.
import { StoryboardGrid } from "./StoryboardGrid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Filter, List } from "lucide-react";

export function SceneList() {
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm z-10">
                <h2 className="text-xl font-bold tracking-tight">Scene List</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" /> Filter
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <Accordion type="single" collapsible className="w-full p-4 space-y-4">
                    {MOCK_SCENES.map((scene) => (
                        <AccordionItem
                            key={scene.id}
                            value={scene.id}
                            className="border border-border rounded-lg bg-card overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary transition-all"
                        >
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4 w-full text-left">
                                    {/* Status Indicator */}
                                    <div className={cn(
                                        "h-2 w-2 rounded-full shrink-0",
                                        scene.status === 'done' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                                            scene.status === 'in-progress' ? "bg-amber-500" :
                                                "bg-neutral-600"
                                    )} />

                                    {/* Title & Stats */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold leading-none mb-1">{scene.title}</h3>
                                        <div className="text-xs text-muted-foreground flex gap-3 font-mono">
                                            <span>{scene.duration}</span>
                                            <span className={cn(
                                                scene.status === 'done' ? "text-green-500" :
                                                    scene.status === 'in-progress' ? "text-amber-500" : ""
                                            )}>
                                                {scene.status === 'done' ? `Done [${scene.shotsCount}/${scene.totalShots} shots]` :
                                                    scene.status === 'in-progress' ? `In Progress [${scene.shotsCount}/${scene.totalShots} shots]` :
                                                        `Pending [0/${scene.totalShots} shots]`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right side thumbnail (visible when collapsed usually, but accordions hide content. We can put a thumb in trigger if we want) */}
                                    <div className="hidden sm:block h-10 w-16 bg-neutral-800 rounded bg-cover bg-center shrink-0 border border-white/10"
                                        style={{ backgroundImage: scene.shots[0] ? `url(${scene.shots[0].thumbnail})` : 'none' }}
                                    />
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 bg-background/50">
                                {/* Internal Layout: Script (Top) -> Storyboard (Bottom) or Split? PRD says Text Area then 3x3 Grid. */}
                                <div className="flex flex-col gap-6 p-6">
                                    {/* Script Editor */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Script / Screenplay</label>
                                        <textarea
                                            className="w-full min-h-[120px] bg-neutral-900/50 border border-border rounded-md p-4 text-sm font-mono text-neutral-300 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                                            defaultValue={scene.script}
                                        />
                                    </div>

                                    {/* Storyboard */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Storyboard Interpretation</label>
                                        <StoryboardGrid scene={scene} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </ScrollArea>
        </div>
    );
}
