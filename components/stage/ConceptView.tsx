import React from "react";
import { SceneList } from "@/components/stage/SceneList";
import { AssetSidebar } from "./AssetSidebar";
import { ScriptSidebar } from "./ScriptSidebar";

export function ConceptView({ viewMode }: { viewMode: "list" | "grid" }) {
    return (
        <div className="relative w-full h-full overflow-hidden">
            {/* Sidebars (Conditionally render inside themselves based on activeSceneId) */}
            <AssetSidebar />
            <ScriptSidebar />

            <div className="w-full h-full p-0">
                <SceneList viewMode={viewMode} />
            </div>
        </div>
    );
}
