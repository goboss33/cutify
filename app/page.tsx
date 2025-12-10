"use client";
import React from "react";
import { GlobalSidebar } from "@/components/sidebar/GlobalSidebar";
import { StageManager } from "@/components/stage/StageManager";
import { TimelineAssembly } from "@/components/timeline/TimelineAssembly";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useProject } from "@/store/ProjectContext";
import { useStore } from "@/store/useStore";
import { Image as ImageIcon } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";

export default function Home() {
  const { currentProject } = useProject();
  const { currentView } = useStore();

  // Determine what to render in the main area
  const renderMainContent = () => {
    // 1. Project View (Highest Priority if project is selected)
    if (currentProject) {
      return (
        <div
          className="grid h-full w-full grid-rows-[1fr_auto] overflow-hidden select-none relative"
        >
          {/* ZONE B: STAGE & SCENE MANAGER */}
          <div className="border-b border-border h-full overflow-y-auto bg-background/50">
            <StageManager />
          </div>

          {/* ZONE C: TIMELINE ASSEMBLY */}
          <div className="bg-background">
            <TimelineAssembly />
          </div>

          <ChatWidget />
        </div>
      );
    }

    // 2. Dashboard View
    if (currentView === 'dashboard') {
      return <Dashboard />;
    }

    // 3. Assets View (Placeholder)
    if (currentView === 'assets') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background/50">
          <div className="p-8 border-2 border-dashed border-muted rounded-xl bg-muted/10 flex flex-col items-center">
            <ImageIcon className="w-16 h-16 opacity-50 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">My Assets</h2>
            <p className="max-w-md text-center">
              Centralized asset management for all your videos coming soon.
            </p>
          </div>
        </div>
      );
    }

    return <Dashboard />; // Default
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* GLOBAL NAVIGATION (Leftmost) */}
      <GlobalSidebar />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-hidden relative">
        {renderMainContent()}
      </main>
    </div>
  );
}
