import { create } from 'zustand';
import { AppView } from '../types';

interface AppStore extends AppView {
  setCurrentView: (view: AppView['currentView']) => void;
  setSelectedPlaylist: (playlist: AppView['selectedPlaylist']) => void;
  setSelectedRadio: (radio: AppView['selectedRadio']) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  selectedPlaylist: null,
  selectedRadio: null,
  sidebarCollapsed: false,

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  setSelectedRadio: (radio) => set({ selectedRadio: radio }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
