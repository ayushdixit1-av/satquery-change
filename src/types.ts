export interface AnalysisItem {
  id: string;
  title: string;
  category: 'Coastal' | 'Agriculture' | 'Environment' | 'Urban';
  date: string;
  thumbnail: string;
  t1Image: string;
  t2Image: string;
  changeMask: string;
  query: string;
  model: string;
  metrics: {
    changedAreaKm2: number;
    changedAreaPct: number;
    iou: number;
    precision: number;
    recall: number;
    f1: number;
  };
  summary: string;
  trace: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  analysis?: AnalysisItem;
  attachments?: {
    t1Url?: string;
    t2Url?: string;
    t1Name?: string;
    t2Name?: string;
  };
}

export type AppView = 'home' | 'chat' | 'settings' | 'help' | 'profile';

export interface SatQuerySettings {
  apiUrl: string;
  apiMode: 'local' | 'live';
  constellation: string;
  cloudTolerance: 5 | 10 | 20 | 50;
  indices: string[];
  crs: string;
}

export const DEFAULT_SETTINGS: SatQuerySettings = {
  apiUrl: '',
  apiMode: 'local',
  constellation: 'Sentinel-2 MSI',
  cloudTolerance: 10,
  indices: ['NDVI', 'NDWI'],
  crs: 'EPSG:4326',
};

export type AnalysisCategory = AnalysisItem['category'];
export type AnalysisViewMode = 'sidebyside' | 'swipe';
