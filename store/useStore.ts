import { create } from 'zustand';

interface AppState {
    activeTab: 'chat' | 'settings';
    setActiveTab: (tab: 'chat' | 'settings') => void;

    activeSceneId: string | null;
    toggleScene: (sceneId: string) => void; // Expands/Collapses

    isPlayerMode: boolean;
    setPlayerMode: (isPlayer: boolean) => void;

    currentView: 'dashboard' | 'assets';
    setCurrentView: (view: 'dashboard' | 'assets') => void;
}

export const useStore = create<AppState>((set) => ({
    activeTab: 'chat',
    setActiveTab: (tab) => set({ activeTab: tab }),

    activeSceneId: null,
    toggleScene: (sceneId) =>
        set((state) => ({
            activeSceneId: state.activeSceneId === sceneId ? null : sceneId,
        })),

    isPlayerMode: false,
    setPlayerMode: (isPlayer) => set({ isPlayerMode: isPlayer }),

    currentView: 'dashboard',
    setCurrentView: (view) => set({ currentView: view }),
}));
