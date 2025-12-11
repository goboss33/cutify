"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Project, Scene } from '@/lib/mockData';

const API_BASE = "http://127.0.0.1:8000";

interface ProjectContextType {
    currentProject: Project | null;
    setCurrentProject: (project: Project | null) => void;
    setScenes: (scenes: Scene[]) => void;
    refreshProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    const setScenes = (scenes: Scene[]) => {
        if (currentProject) {
            setCurrentProject({ ...currentProject, scenes });
        }
    };

    const refreshProject = useCallback(async () => {
        if (!currentProject?.id) return;
        try {
            const res = await fetch(`${API_BASE}/api/projects/${currentProject.id}`);
            if (res.ok) {
                const updatedProject = await res.json();
                setCurrentProject(updatedProject);
            }
        } catch (e) {
            console.error("Failed to refresh project", e);
        }
    }, [currentProject?.id]);

    return (
        <ProjectContext.Provider value={{ currentProject, setCurrentProject, setScenes, refreshProject }}>
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

