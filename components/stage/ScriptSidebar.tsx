
import React, { useState } from 'react';
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";
import { Button } from "@/components/ui/button";
import { X, Loader2, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScriptSidebar() {
    const { activeSceneId, toggleScene } = useStore();
    const { currentProject, setScenes } = useProject();
    const [generatingScript, setGeneratingScript] = useState(false);

    if (!activeSceneId || !currentProject) return null;

    const activeScene = currentProject.scenes?.find(s => String(s.id) === String(activeSceneId));
    if (!activeScene) return null;

    const handleGenerateScript = async () => {
        setGeneratingScript(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/scenes/${activeScene.id}/generate-script`, {
                method: "POST"
            });
            if (!response.ok) throw new Error("Failed to generate script");
            const updatedScene = await response.json();

            // Update local state
            if (currentProject.scenes) {
                const updatedScenes = currentProject.scenes.map(s => s.id === updatedScene.id ? updatedScene : s);
                setScenes(updatedScenes);
            }

        } catch (error) {
            console.error(error);
            alert("Error generating script");
        } finally {
            setGeneratingScript(false);
        }
    };

    const handleScriptChange = async (newScript: string) => {
        // Immediate localized update for responsiveness (optional, or debounce)
        // Here we just want to update the project state potentially?
        // Ideally we debounce save to backend. For now let's just update local state on blur or something.
    };

    const handleBlur = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
        const newScript = e.target.value;
        if (newScript === activeScene.script) return;

        try {
            const response = await fetch(`http://127.0.0.1:8000/api/scenes/${activeScene.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ script: newScript })
            });

            if (response.ok) {
                const updated = await response.json();
                if (currentProject.scenes) {
                    const updatedScenes = currentProject.scenes.map(s => s.id === updated.id ? updated : s);
                    setScenes(updatedScenes);
                }
            }

        } catch (e) {
            console.error("Failed to save script", e);
        }
    };


    return (
        <div className="absolute right-0 top-0 h-full w-[320px] bg-background/95 backdrop-blur-sm border-l border-border flex flex-col animate-in slide-in-from-right-4 duration-300 z-50 shadow-xl">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted/20">
                <span className="font-semibold text-sm">Script Editor</span>
                {/* We don't necessarily need a close button if the left one closes selection, but it's good UX */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-foreground"
                    onClick={() => toggleScene(activeSceneId)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scene Summary / Script</label>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-2 text-xs"
                        disabled={generatingScript}
                        onClick={handleGenerateScript}
                    >
                        {generatingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenTool className="h-3 w-3" />}
                        {activeScene.script ? "Regenerate Script" : "Write Script with AI"}
                    </Button>
                </div>

                <textarea
                    className="flex-1 w-full bg-neutral-900/50 border border-border rounded-md p-4 text-sm font-mono text-neutral-300 resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    defaultValue={activeScene.script || activeScene.summary || ""}
                    placeholder="Write your scene script here..."
                    onBlur={handleBlur}
                    key={activeScene.id + (activeScene.script ? '-script' : '-summary')} // Remount on scene change
                />
            </div>
        </div>
    );
}
