"use client";

import React from "react";
import { SceneList } from "@/components/stage/SceneList";
export function ConceptView({ viewMode }: { viewMode: "list" | "grid" }) {
    return (
        <div className="flex-1 overflow-hidden w-full h-full p-0">
            <SceneList viewMode={viewMode} />
        </div>
    );
}
