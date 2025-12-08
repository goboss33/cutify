"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Interface matching backend response
export interface Project {
    id: number;
    title: string;
    genre: string | null;
    pitch: string | null;
    visual_style: string | null;
    target_audience: string | null;
    created_at: string;
    status: string;
}

interface ProjectContextType {
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    return (
        <ProjectContext.Provider value={{ currentProject, setCurrentProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
