import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../lib/store';
import { offline } from '../lib/offlineArea';

/**
 * When the map images can't load (offline), draw the streets and paths from your saved area
 * so the map still makes sense: main roads thicker, footpaths dashed.
 */
export function SavedStreets({ force = false }: { force?: boolean }) {
  const map = useMap();
  const { area, online } = useStore(offline);
  const show = !!area && (force || !online);
  useEffect(() => {
    if (!show || !area) return;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
    const box = map.getContainer(), prevBg = box.style.background;
    box.style.background = dark ? '#111A2C' : '#F3F1EA';
    // own layer between the map images (200) and routes (400)
    if (!map.getPane('savedStreets')) { const p = map.createPane('savedStreets'); p.style.zIndex = '350'; p.style.pointerEvents = 'none'; }
    const renderer = L.canvas({ padding: 0.3, pane: 'savedStreets' });
    const style = [
      { color: dark ? '#5A6785' : '#FFFFFF', weight: 7, outline: dark ? '#2A3550' : '#D9D3C4' },
      { color: dark ? '#43506C' : '#FFFFFF', weight: 4.5, outline: dark ? '#26304A' : '#DDD7C8' },
      { color: dark ? '#6B7FA8' : '#B7A98A', weight: 1.6, outline: null }
    ];
    const group = L.layerGroup();
    for (const pass of [0, 1]) for (const w of area.ways) {
      const st = style[w.cls], pts = Array.from(w.nodes, i => [area.lat[i], area.lng[i]] as [number, number]);
      if (pass === 0 && st.outline) L.polyline(pts, { renderer, color: st.outline, weight: st.weight + 2, interactive: false }).addTo(group);
      if (pass === 1) L.polyline(pts, { renderer, color: st.color, weight: st.weight, dashArray: w.cls === 2 ? '4 4' : undefined, interactive: false }).addTo(group);
    }
    group.addTo(map);
    return () => { group.remove(); box.style.background = prevBg; };
  }, [map, area, show]);
  return null;
}
