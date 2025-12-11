"use client";

import React, { useState, useEffect } from 'react';
import { useStore } from "@/store/useStore";
import { useProject } from "@/store/ProjectContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Types for assets
interface Character {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}

interface Location {
    id: number;
    project_id: number;
    name: string;
    image_url: string | null;
}

const API_BASE = "http://127.0.0.1:8000";

export function AssetSidebar() {
    const { activeSceneId } = useStore();
    const { currentProject, refreshProject } = useProject();

    const [characters, setCharacters] = useState<Character[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);

    // Get active scene's associated assets
    const activeScene = currentProject?.scenes?.find(s => String(s.id) === String(activeSceneId));
    const sceneCharacterIds = new Set(activeScene?.characters?.map(c => c.id) || []);
    const sceneLocationId = activeScene?.location_id || activeScene?.location?.id || null;

    // Fetch project assets on mount
    useEffect(() => {
        if (!currentProject?.id) return;

        const fetchAssets = async () => {
            setLoading(true);
            try {
                const [charsRes, locsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/projects/${currentProject.id}/characters`),
                    fetch(`${API_BASE}/api/projects/${currentProject.id}/locations`)
                ]);
                if (charsRes.ok) setCharacters(await charsRes.json());
                if (locsRes.ok) setLocations(await locsRes.json());
            } catch (e) {
                console.error("Failed to fetch assets", e);
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, [currentProject?.id]);

    // Toggle character association with scene
    const toggleCharacter = async (characterId: number) => {
        if (!activeSceneId) return;

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/characters/${characterId}`, {
                method: "POST"
            });
            // Refresh project to update scene data
            refreshProject?.();
        } catch (e) {
            console.error("Toggle character failed", e);
        }
    };

    // Toggle location association with scene
    const toggleLocation = async (locationId: number) => {
        if (!activeSceneId) return;

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/location/${locationId}`, {
                method: "POST"
            });
            // Refresh project to update scene data
            refreshProject?.();
        } catch (e) {
            console.error("Toggle location failed", e);
        }
    };

    // Add new character
    const addCharacter = async () => {
        if (!currentProject?.id) return;

        const name = prompt("Nom du personnage:");
        if (!name?.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/api/projects/${currentProject.id}/characters`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), image_url: null })
            });
            if (res.ok) {
                const newChar = await res.json();
                setCharacters(prev => [...prev, newChar]);
            }
        } catch (e) {
            console.error("Add character failed", e);
        }
    };

    // Add new location
    const addLocation = async () => {
        if (!currentProject?.id) return;

        const name = prompt("Nom du lieu:");
        if (!name?.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/api/projects/${currentProject.id}/locations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), image_url: null })
            });
            if (res.ok) {
                const newLoc = await res.json();
                setLocations(prev => [...prev, newLoc]);
            }
        } catch (e) {
            console.error("Add location failed", e);
        }
    };

    if (!currentProject || !activeSceneId) return null;

    return (
        <div className="absolute left-0 top-0 h-full w-[320px] bg-background/95 backdrop-blur-sm border-r border-border flex flex-col z-40">
            {/* Header */}
            <div className="h-12 border-b border-border flex items-center px-4 bg-muted/20">
                <span className="font-semibold text-sm">Project Assets</span>
            </div>

            {/* Tabs */}
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
                            <MapPin className="h-4 w-4" /> Locations
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Characters Tab */}
                        <TabsContent value="characters" className="m-0">
                            {!activeSceneId && (
                                <div className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded-md mb-3">
                                    Sélectionnez une scène pour associer des personnages
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                {characters.map((char) => {
                                    const isLinked = sceneCharacterIds.has(char.id);
                                    return (
                                        <button
                                            key={char.id}
                                            onClick={() => toggleCharacter(char.id)}
                                            disabled={!activeSceneId}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-2 rounded-lg transition-all",
                                                activeSceneId && "hover:bg-muted/50 cursor-pointer",
                                                !activeSceneId && "opacity-50 cursor-not-allowed",
                                                isLinked && "ring-2 ring-primary bg-primary/10"
                                            )}
                                            title={char.name}
                                        >
                                            {/* Avatar */}
                                            <div className={cn(
                                                "h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold transition-all",
                                                char.image_url
                                                    ? "bg-cover bg-center"
                                                    : "bg-neutral-700",
                                                isLinked && "ring-2 ring-primary"
                                            )}
                                                style={char.image_url ? { backgroundImage: `url(${char.image_url})` } : {}}
                                            >
                                                {!char.image_url && (
                                                    <User className="h-5 w-5 text-neutral-400" />
                                                )}
                                            </div>
                                            <span className="text-xs text-center truncate w-full">{char.name}</span>
                                        </button>
                                    );
                                })}

                                {/* Add Character Button */}
                                <button
                                    onClick={addCharacter}
                                    className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all hover:bg-muted/50 cursor-pointer border-2 border-dashed border-neutral-700 hover:border-primary"
                                >
                                    <div className="h-12 w-12 rounded-full flex items-center justify-center border-2 border-dashed border-neutral-600">
                                        <Plus className="h-5 w-5 text-neutral-400" />
                                    </div>
                                    <span className="text-xs text-neutral-400">Ajouter</span>
                                </button>
                            </div>
                        </TabsContent>

                        {/* Locations Tab */}
                        <TabsContent value="locations" className="m-0">
                            {!activeSceneId && (
                                <div className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded-md mb-3">
                                    Sélectionnez une scène pour associer un lieu
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                {locations.map((loc) => {
                                    const isLinked = sceneLocationId === loc.id;
                                    return (
                                        <button
                                            key={loc.id}
                                            onClick={() => toggleLocation(loc.id)}
                                            disabled={!activeSceneId}
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-2 rounded-lg transition-all",
                                                activeSceneId && "hover:bg-muted/50 cursor-pointer",
                                                !activeSceneId && "opacity-50 cursor-not-allowed",
                                                isLinked && "ring-2 ring-primary bg-primary/10"
                                            )}
                                            title={loc.name}
                                        >
                                            {/* Thumbnail */}
                                            <div className={cn(
                                                "h-16 w-full rounded-md flex items-center justify-center transition-all",
                                                loc.image_url
                                                    ? "bg-cover bg-center"
                                                    : "bg-neutral-700",
                                                isLinked && "ring-2 ring-primary"
                                            )}
                                                style={loc.image_url ? { backgroundImage: `url(${loc.image_url})` } : {}}
                                            >
                                                {!loc.image_url && (
                                                    <MapPin className="h-6 w-6 text-neutral-400" />
                                                )}
                                            </div>
                                            <span className="text-xs text-center truncate w-full">{loc.name}</span>
                                        </button>
                                    );
                                })}

                                {/* Add Location Button */}
                                <button
                                    onClick={addLocation}
                                    className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all hover:bg-muted/50 cursor-pointer border-2 border-dashed border-neutral-700 hover:border-primary"
                                >
                                    <div className="h-16 w-full rounded-md flex items-center justify-center border-2 border-dashed border-neutral-600">
                                        <Plus className="h-6 w-6 text-neutral-400" />
                                    </div>
                                    <span className="text-xs text-neutral-400">Ajouter</span>
                                </button>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
