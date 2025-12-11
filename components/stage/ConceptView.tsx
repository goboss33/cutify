import React from "react";
import { SceneList } from "@/components/stage/SceneList";
import { AssetSidebar } from "./AssetSidebar";
import { ScriptSidebar } from "./ScriptSidebar";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function ConceptView({ viewMode }: { viewMode: "list" | "grid" }) {
    // Static layout: Sidebars are absolute. Center content ALWAYS has padding.
    // This reserves space for the sidebars permanently, so no resizing occurs when they open/close.
    return (
        <div className="relative w-full h-full overflow-hidden">
            {/* Sidebars (Conditionally render inside themselves based on activeSceneId) */}
            <AssetSidebar />
            <ScriptSidebar />

            {/* Main Content - Permanent padding to reserve space for sidebars */}
            <div className="w-full h-full p-0 px-[320px]">
                <div className="w-full h-full overflow-hidden border-x border-border/10 bg-background">
                    <SceneList viewMode={viewMode} />
                </div>
            </div>
        </div>
    );
}
