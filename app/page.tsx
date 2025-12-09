"use client";

import { ProductionSidebar } from "@/components/sidebar/ProductionSidebar";
import { StageManager } from "@/components/stage/StageManager";
import { TimelineAssembly } from "@/components/timeline/TimelineAssembly";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useProject } from "@/store/ProjectContext";
import { useEffect } from "react";

export default function Home() {
  const { currentProject, setCurrentProject } = useProject();

  // On mount, ensure we start with no project (Dashboard view) 
  // unless we want to persist last session (optional future feature)
  // For now, let's force Dashboard on refresh for clarity
  useEffect(() => {
    // Optional: setCurrentProject(null); 
    // Actually, if we want persistence, we keep it. If we want "My Projects" first, we null it.
    // Let's rely on Context default (null)
  }, []);

  if (!currentProject) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <ProductionSidebar /> {/* Sidebar remains visible for Profile access */}
        <Dashboard />
      </div>
    );
  }

  return (
    <div className="grid h-screen w-screen grid-cols-[300px_1fr] grid-rows-[1fr_auto] bg-background text-foreground overflow-hidden">
      {/* ZONE A: SIDEBAR (Left, fixed width) */}
      <div className="row-span-2 border-r border-border">
        <ProductionSidebar />
      </div>

      {/* ZONE B: STAGE & SCENE MANAGER (Top Right) */}
      <div className="border-b border-border h-full overflow-y-auto">
        <StageManager />
      </div>

      {/* ZONE C: TIMELINE ASSEMBLY (Bottom Right) */}
      <div className="">
        <TimelineAssembly />
      </div>
    </div>
  );
}
