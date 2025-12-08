"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Project, Scene } from '@/lib/mockData';

interface ProjectContextType {
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    setScenes: (scenes: Scene[]) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    const setScenes = (scenes: Scene[]) => {
        if (currentProject) {
            setCurrentProject({ ...currentProject, scenes });
        }
    };

    return (
        <ProjectContext.Provider value={{ currentProject, setCurrentProject, setScenes }}>
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
