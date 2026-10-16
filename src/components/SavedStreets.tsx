import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../lib/store';
import { offline, type SavedArea } from '../lib/offlineArea';

/** [south, west, north, east] of every saved street, cached per area */
const bboxCache = new WeakMap<SavedArea, Float64Array[]>();
function bboxes(a: SavedArea) {
  let b = bboxCache.get(a);
  if (!b) {
    b = a.ways.map(w => { let s = 90, wst = 180, n = -90, e = -180; for (const i of w.nodes) { const la = a.lat[i], lo = a.lng[i]; if (la < s) s = la; if (la > n) n = la; if (lo < wst) wst = lo; if (lo > e) e = lo; } return Float64Array.of(s, wst, n, e); });
    bboxCache.set(a, b);
  }
  return b;
}

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
    // each street's bounding box, worked out once per saved area
    const boxes = bboxes(area);
    const draw = () => {
      group.clearLayers();
      const vb = map.getBounds().pad(0.5), zoom = map.getZoom();
      const s = vb.getSouth(), n = vb.getNorth(), w = vb.getWest(), e = vb.getEast();
      const visible: number[] = [];
      for (let k = 0; k < area.ways.length; k++) {
        const bb = boxes[k];
        if (bb[2] < s || bb[0] > n || bb[3] < w || bb[1] > e) continue;
        if (zoom < 13 && area.ways[k].cls === 2) continue;   // far out: skip footpaths
        if (zoom < 11 && area.ways[k].cls === 1) continue;   // very far out: main roads only
        visible.push(k);
      }
      for (const pass of [0, 1]) for (const k of visible) {
        const way = area.ways[k], st = style[way.cls], pts = Array.from(way.nodes, i => [area.lat[i], area.lng[i]] as [number, number]);
        if (pass === 0 && st.outline) L.polyline(pts, { renderer, color: st.outline, weight: st.weight + 2, interactive: false }).addTo(group);
        if (pass === 1) L.polyline(pts, { renderer, color: st.color, weight: st.weight, dashArray: way.cls === 2 ? '4 4' : undefined, interactive: false }).addTo(group);
      }
    };
    draw();
    map.on('moveend zoomend', draw);
    group.addTo(map);
    return () => { map.off('moveend zoomend', draw); group.remove(); box.style.background = prevBg; };
  }, [map, area, show]);
  return null;
}
