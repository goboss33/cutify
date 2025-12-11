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

    // Optimistic state for immediate UI feedback
    const [optimisticCharacterIds, setOptimisticCharacterIds] = useState<Set<number> | null>(null);
    const [optimisticLocationId, setOptimisticLocationId] = useState<number | null | undefined>(undefined);

    // Use optimistic state if available, otherwise use server state
    const displayCharacterIds = optimisticCharacterIds ?? sceneCharacterIds;
    const displayLocationId = optimisticLocationId !== undefined ? optimisticLocationId : sceneLocationId;

    // Toggle character association with scene (OPTIMISTIC)
    const toggleCharacter = async (characterId: number) => {
        if (!activeSceneId) return;

        // Optimistic update - toggle immediately
        const currentIds = new Set(displayCharacterIds);
        if (currentIds.has(characterId)) {
            currentIds.delete(characterId);
        } else {
            currentIds.add(characterId);
        }
        setOptimisticCharacterIds(currentIds);

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/characters/${characterId}`, {
                method: "POST"
            });
            // Sync with server in background (optional, for data consistency)
            refreshProject?.();
        } catch (e) {
            console.error("Toggle character failed", e);
            // Revert on error
            setOptimisticCharacterIds(null);
        }
    };

    // Toggle location association with scene (OPTIMISTIC)
    const toggleLocation = async (locationId: number) => {
        if (!activeSceneId) return;

        // Optimistic update - toggle immediately
        const newLocationId = displayLocationId === locationId ? null : locationId;
        setOptimisticLocationId(newLocationId);

        try {
            await fetch(`${API_BASE}/api/scenes/${activeSceneId}/location/${locationId}`, {
                method: "POST"
            });
            // Sync with server in background
            refreshProject?.();
        } catch (e) {
            console.error("Toggle location failed", e);
            // Revert on error
            setOptimisticLocationId(undefined);
        }
    };

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<"character" | "location">("character");

    // Open modal for character creation
    const openCharacterModal = () => {
        setModalType("character");
        setModalOpen(true);
    };

    // Open modal for location creation
    const openLocationModal = () => {
        setModalType("location");
        setModalOpen(true);
    };

    // Handle new asset created
    const handleAssetCreated = (asset: any) => {
        if (modalType === "character") {
            setCharacters(prev => [...prev, asset]);
        } else {
            setLocations(prev => [...prev, asset]);
        }
    };

    if (!currentProject || !activeSceneId) return null;

    // Import the modal component dynamically to avoid circular deps
    const AssetCreationModal = React.lazy(() =>
        import("./AssetCreationModal").then(mod => ({ default: mod.AssetCreationModal }))
    );

    return (
        <>
            {/* Modal */}
            <React.Suspense fallback={null}>
                <AssetCreationModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    type={modalType}
                    projectId={currentProject.id}
                    onCreated={handleAssetCreated}
                />
            </React.Suspense>

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
                                        const isLinked = displayCharacterIds.has(char.id);
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
                                        onClick={openCharacterModal}
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
                                        const isLinked = displayLocationId === loc.id;
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
                                        onClick={openLocationModal}
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
        </>
    );
}
