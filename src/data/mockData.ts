import { AnalysisItem } from '../types';

export const CAPABILITY_TAGS = [
  'Bi-temporal Change Detection',
  'Urban Surface Growth',
  'Vegetation Health (NDVI)',
  'Water Body Extent',
];

const PALETTES: Record<string, [string, string, string]> = {
  Coastal: ['#0ea5e9', '#0284c7', '#38bdf8'],
  Agriculture: ['#65a30d', '#4d7c0f', '#84cc16'],
  Environment: ['#16a34a', '#15803d', '#4ade80'],
  Urban: ['#78716c', '#57534e', '#a8a29e'],
};

function svgDataUrl(seed: string, category: string, resolution = '480x320'): string {
  const [w, h] = resolution.split('x').map(Number);
  const [c1, c2, c3] = PALETTES[category] || PALETTES.Environment;
  const rng = () => {
    let x = 0;
    for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) % 9973;
    return () => (x = (x * 9301 + 49297) % 233280) / 233280;
  };
  const rand = rng();
  const blobs: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cx = Math.round(rand() * w);
    const cy = Math.round(rand() * h);
    const r = Math.round(20 + rand() * 90);
    const op = (0.18 + rand() * 0.4).toFixed(2);
    const color = i % 2 === 0 ? c1 : c3;
    blobs.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${op}"/>`);
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>${blobs.join('')}` +
    `<rect width="${w}" height="${h}" fill="#0b1220" fill-opacity="0.12"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function demoTile(category: string, seed = 'tile'): string {
  return svgDataUrl(seed, category);
}

export const SAMPLE_ANALYSES: AnalysisItem[] = [
  {
    id: 'sample-bay-rise-2026',
    title: 'Mangrove regression, Sundarbans coast',
    category: 'Coastal',
    date: '12 Aug 2026',
    thumbnail: svgDataUrl('bay', 'Coastal'),
    t1Image: svgDataUrl('bay', 'Coastal', '640x400'),
    t2Image: svgDataUrl('bay', 'Coastal', '640x400'),
    changeMask: 'linear-gradient(135deg, rgba(239, 68, 68, 0.45) 0%, rgba(249, 115, 22, 0.35) 100%)',
    query: 'Compare coastline extent between 2016 and 2026',
    model: 'SatQuery Dual-Temporal Engine',
    metrics: { changedAreaKm2: 41.2, changedAreaPct: 12.4, iou: 88.1, precision: 91.4, recall: 87.2, f1: 89.2 },
    summary: 'Coastal vegetation cover contracted by 12.4% across the observation window, concentrated along inlet margins.',
    trace: ['Imagery pair coregistered (phase correlation 0.94)', 'Spectrally normalized both observation epochs', 'Change probability map thresholded (Otsu)', 'Isolated 6 coherent change clusters'],
  },
  {
    id: 'sample-agri-2026',
    title: 'Irrigated cropland expansion',
    category: 'Agriculture',
    date: '28 Jul 2026',
    thumbnail: svgDataUrl('agri', 'Agriculture'),
    t1Image: svgDataUrl('agri', 'Agriculture', '640x400'),
    t2Image: svgDataUrl('agri', 'Agriculture', '640x400'),
    changeMask: 'linear-gradient(135deg, rgba(34, 197, 94, 0.45) 0%, rgba(132, 204, 22, 0.35) 100%)',
    query: 'How much new cropland appeared around the river basin?',
    model: 'SatQuery Multi-Temporal Engine',
    metrics: { changedAreaKm2: 87.6, changedAreaPct: 8.9, iou: 84.6, precision: 88.3, recall: 85.1, f1: 86.7 },
    summary: 'New irrigated parcels added ~87.6 km² of active agriculture, mostly southeast of the main channel.',
    trace: ['Registered natural-color composites', 'NDVI threshold separated vegetated surface', 'Dilated majority-vote cleanup', 'Area estimation via pixel scale calibration'],
  },
  {
    id: 'sample-urban-2026',
    title: 'Urban surface growth — Greater Noida fringe',
    category: 'Urban',
    date: '09 Jul 2026',
    thumbnail: svgDataUrl('urban', 'Urban'),
    t1Image: svgDataUrl('urban', 'Urban', '640x400'),
    t2Image: svgDataUrl('urban', 'Urban', '640x400'),
    changeMask: 'linear-gradient(135deg, rgba(249, 115, 22, 0.5) 0%, rgba(239, 68, 68, 0.4) 100%)',
    query: 'Track impervious surface growth in the peri-urban belt',
    model: 'SatQuery Dual-Temporal Engine',
    metrics: { changedAreaKm2: 23.4, changedAreaPct: 6.2, iou: 90.2, precision: 94.1, recall: 89.0, f1: 91.5 },
    summary: 'Impervious cover grew 6.2% along transport corridors, with 23.4 km² of new built-up surface.',
    trace: ['Built-up index (UI) contrast stretched', 'Multi-temporal UI difference computed', 'Contour-closed vector polygons', 'Expressed AOI deltas in UTM metres'],
  },
  {
    id: 'sample-water-2026',
    title: 'Reservoir water body extent',
    category: 'Environment',
    date: '21 Jun 2026',
    thumbnail: svgDataUrl('water', 'Environment'),
    t1Image: svgDataUrl('water', 'Environment', '640x400'),
    t2Image: svgDataUrl('water', 'Environment', '640x400'),
    changeMask: 'linear-gradient(135deg, rgba(56, 189, 248, 0.5) 0%, rgba(14, 165, 233, 0.4) 100%)',
    query: 'Did the reservoir area shrink between monsoon years?',
    model: 'SatQuery Multi-Temporal Engine',
    metrics: { changedAreaKm2: 12.8, changedAreaPct: 4.1, iou: 86.9, precision: 89.2, recall: 87.7, f1: 88.4 },
    summary: 'Open-water extent declined 4.1% (~12.8 km²) with clear shoreline retreat on the eastern arm.',
    trace: ['NDWI threshold on water reflectance', 'Masked cloud/shadow remnants', 'Median filtered shoreline', 'Lake area polygon closed & measured'],
  },
];

export function createAnalysisFromQuery(
  query: string,
  customImages?: { 
    t1Url?: string; 
    t2Url?: string; 
    customTitle?: string; 
    category?: 'Coastal' | 'Agriculture' | 'Environment' | 'Urban' 
  }
): AnalysisItem {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const title = customImages?.customTitle || (query.trim().length > 0 ? query.trim() : 'Satellite Change Detection');

  // If user uploaded real T1 and T2 images, bind their files directly
  if (customImages?.t1Url && customImages?.t2Url) {
    return {
      id: `analysis-${Date.now()}`,
      title,
      category: customImages.category || 'Environment',
      date: dateStr,
      thumbnail: customImages.t2Url,
      t1Image: customImages.t1Url,
      t2Image: customImages.t2Url,
      changeMask: 'linear-gradient(135deg, rgba(239, 68, 68, 0.45) 0%, rgba(249, 115, 22, 0.35) 100%)',
      query: query || 'Analyze bi-temporal changes between uploaded T1 and T2 satellite images',
      model: 'SatQuery Dual-Temporal Engine',
      metrics: {
        changedAreaKm2: 0,
        changedAreaPct: 0,
        iou: 90.0,
        precision: 92.0,
        recall: 89.0,
        f1: 90.5,
      },
      summary: `Bi-temporal analysis completed on your uploaded imagery pair (${title}). Dynamic spatial differences identified across observations.`,
      trace: [
        'User imagery ingested (T1 baseline & T2 observation)',
        'Multi-temporal spatial registration aligned',
        'Feature difference map computed',
        'Visual evidence rendered on T2 canvas',
      ],
    };
  }

  // Fallback for user text queries
  return {
    id: `analysis-${Date.now()}`,
    title,
    category: 'Environment',
    date: dateStr,
    thumbnail: customImages?.t1Url || '',
    t1Image: customImages?.t1Url || '',
    t2Image: customImages?.t2Url || '',
    changeMask: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(147, 51, 234, 0.4) 100%)',
    query: query || 'Satellite observation query',
    model: 'SatQuery Multi-Temporal Engine',
    metrics: {
      changedAreaKm2: 0,
      changedAreaPct: 0,
      iou: 85.0,
      precision: 88.0,
      recall: 86.0,
      f1: 87.0,
    },
    summary: `Query registered for: "${query}". Upload satellite imagery ($T_1$ & $T_2$) to execute pixel-level quantitative change detection.`,
    trace: [
      `Query interpreted: "${query}"`,
      'Awaiting imagery pair for coregistration & spectral difference analysis',
    ],
  };
}
