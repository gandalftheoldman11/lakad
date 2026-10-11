import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

const blobToBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

/** Save or share a generated file on every platform */
export async function saveFile(name: string, content: string | Blob, mime: string, mode: 'save' | 'share' = 'save') {
  if (isNative) {
    const res = typeof content === 'string'
      ? await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
      : await Filesystem.writeFile({ path: name, data: await blobToBase64(content), directory: Directory.Cache });
    await Share.share({ title: name, files: [res.uri] });
    return;
  }
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const file = new File([blob], name, { type: mime });
  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
