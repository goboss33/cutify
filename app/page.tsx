import { ProductionSidebar } from "@/components/sidebar/ProductionSidebar";
import { StageManager } from "@/components/stage/StageManager";
import { TimelineAssembly } from "@/components/timeline/TimelineAssembly";

export default function Home() {
  return (
    <div className="grid h-screen w-screen grid-cols-[300px_1fr] grid-rows-[65%_35%] bg-background text-foreground overflow-hidden">
      {/* ZONE A: SIDEBAR (Left, fixed width) */}
      <div className="row-span-2 border-r border-border">
        <ProductionSidebar />
      </div>

      {/* ZONE B: STAGE & SCENE MANAGER (Top Right) */}
      <div className="border-b border-border">
        <StageManager />
      </div>

      {/* ZONE C: TIMELINE ASSEMBLY (Bottom Right) */}
      <div className="">
        <TimelineAssembly />
      </div>
    </div>
  );
}
