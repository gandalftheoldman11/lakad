import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { drawShareCard, loadBadgeImage, type ShareFormat, type ShareStyle } from '../lib/shareImage';
import { useMyBadge } from '../lib/myBadge';
import { BADGES } from '../lib/badges';
import { Badge } from '../components/Badge';
import { saveFile } from '../lib/files';
import { ymd } from '../lib/format';
import { openDialog } from '../lib/dialogs';
import { toast } from '../lib/ui';
import { Actions, Button, Segmented, SheetTitle } from '../components/ui';
import { IconShare } from '../components/icons';

const CHECKER = 'repeating-conic-gradient(#9aa6b5 0 25%, #c3ccd7 0 50%) 0 0/12px 12px';

export function ShareSheet({ id }: { id: string }) {
  const { acts, settings } = useStore(data);
  const a = acts.find(x => x.id === id);
  const [style, setStyle] = useState<ShareStyle>('night');
  const [format, setFormat] = useState<ShareFormat>('post');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const level = useMyBadge().level;
  const lv = BADGES[level - 1];
  // your level's look: its name and colours, with your badge as the preview
  const STYLES: [ShareStyle, string, string][] = [
    ['night', 'Blue', '#1F4FE0'],
    ['level', lv.name, `linear-gradient(160deg, ${lv.colors.panelTop ?? lv.colors.faceDark}, ${lv.colors.panelBottom ?? lv.colors.face})`],
    ['sticker', 'Sticker', CHECKER]
  ];

  useEffect(() => {
    let live = true;
    (async () => {
      try { await document.fonts.ready; } catch { /* noop */ }
      const badge = style === 'level' ? await loadBadgeImage(level).catch(() => null) : null;
      if (live && a && ref.current) drawShareCard(ref.current, a, settings, style, format, { level, badge });
    })();
    return () => { live = false; };
  }, [a, settings, style, format, level]);

  if (!a) return <><SheetTitle>Activity not found</SheetTitle></>;

  async function share() {
    const c = ref.current; if (!c || !a) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Image failed'))), 'image/png'));
      await saveFile(`lakad-${a.type}-${ymd(a.start)}-${style}.png`, blob, 'image/png', 'share');
    } catch { toast("Couldn't create the image"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SheetTitle sub={style === 'sticker' ? 'Transparent background, to place over your own photo.' : 'Choose a style and size, then share or save.'}>Share image</SheetTitle>
      <div className="mt-4 grid place-items-center rounded-[20px] p-3" style={{ background: style === 'sticker' ? CHECKER : 'var(--surface-2)' }}>
        <canvas ref={ref} className={`block h-auto rounded-[14px] shadow-[var(--lift)] ${format === 'story' ? 'w-[52%]' : 'w-[78%]'}`} aria-label="Share image preview" />
      </div>
      {(settings.privacyTrim ?? 200) > 0 && a.route.length > 1 && <p className="m-0 mt-2 text-center text-[13px] text-muted">The first and last {settings.privacyTrim ?? 200} m of the route are hidden. Change this in Settings › Privacy zone.</p>}
      <div className="mt-4 flex gap-2.5" role="group" aria-label="Style">
        {STYLES.map(([k, label, bg]) => (
          <button key={k} aria-pressed={style === k} onClick={() => setStyle(k)}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-[16px] p-2 text-[13px] font-semibold transition-colors ${style === k ? 'bg-cobalt-soft text-cobalt ring-2 ring-cobalt' : 'bg-surface-2 text-muted'}`}>
            <span className="relative grid h-9 w-full place-items-center overflow-hidden rounded-[10px]" style={{ background: bg }}>{k === 'level' && <Badge level={level} size={level >= 6 ? 54 : 34} animate={false} />}</span>{label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <Segmented value={format} onChange={setFormat} label="Size" options={[['post', 'Post 4:5'], ['story', 'Story 9:16']]} />
      </div>
      <Actions>
        <Button variant="primary" disabled={busy} onClick={share}><IconShare />{busy ? 'Preparing…' : 'Share'}</Button>
        <Button onClick={() => openDialog({ kind: 'detail', id })}>Back</Button>
      </Actions>
    </>
  );
}
