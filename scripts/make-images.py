"""Draws every Lakad icon and splash image (web, Android, iPhone). Run: python3 scripts/make-images.py (needs Pillow)."""
from PIL import Image, ImageDraw
import os

BLUE, MANGO = '#1F4FE0', '#FFB627'

def bz(a, b, c, d, t): return (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d
CURVE = []
for i in range(101):
    t = i / 100
    if t <= .5: u = t*2; CURVE.append((bz(10, 20, 23, 32, u), bz(46, 43, 24, 24, u)))
    else: u = (t-.5)*2; CURVE.append((bz(32, 41, 44, 54, u), bz(24, 24, 44, 42, u)))

def mark(size, inset, background):
    """The Lakad route-line mark. background: None, 'rounded', 'rounded-android', 'circle' or 'square'."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if background == 'rounded': d.rounded_rectangle([0, 0, S, S], radius=int(S*.22), fill=BLUE)           # web icons
    elif background == 'rounded-android': d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*.2), fill=BLUE)
    elif background == 'circle': d.ellipse([0, 0, S-1, S-1], fill=BLUE)
    elif background == 'square': d.rectangle([0, 0, S, S], fill=BLUE)
    sc = lambda v: int(S*(inset + (1-2*inset)*v/64)); w = max(2, int(S*(1-2*inset)*6/64))
    d.line([(sc(x), sc(y)) for x, y in CURVE], fill='white', width=w, joint='curve')
    x, y = CURVE[0]; r = w//2; d.ellipse([sc(x)-r, sc(y)-r, sc(x)+r, sc(y)+r], fill='white')
    r = w; d.ellipse([sc(54)-r, sc(42)-r, sc(54)+r, sc(42)+r], fill=MANGO)
    return im.resize((size, size), Image.LANCZOS)

def save(im, path, rgb=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (im.convert('RGB') if rgb else im).save(path, optimize=True)

def splash(w, h):
    o = Image.new('RGB', (w, h), BLUE); s = min(w, h)//4
    fg = mark(s*2, 0.25, None); o.paste(fg, ((w-2*s)//2, (h-2*s)//2), fg); return o

# Web (PWA)
save(mark(192, 0.0, 'rounded'), 'public/icon-192.png')
save(mark(512, 0.0, 'rounded'), 'public/icon-512.png')
save(mark(512, 0.12, 'square'), 'public/icon-maskable-512.png')
save(mark(180, 0.0, 'square'), 'public/apple-touch-icon.png')

# Android launcher icons (adaptive foreground keeps the mark inside the safe zone)
RES = 'android/app/src/main/res'
for dens, (ic, fg) in {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}.items():
    save(mark(ic, 0.12, 'rounded-android'), f'{RES}/mipmap-{dens}/ic_launcher.png')
    save(mark(ic, 0.12, 'circle'), f'{RES}/mipmap-{dens}/ic_launcher_round.png')
    save(mark(fg, 0.25, None), f'{RES}/mipmap-{dens}/ic_launcher_foreground.png')

# Android splash screens
for folder, (w, h) in {'drawable': (480, 320), 'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480), 'drawable-land-xhdpi': (1280, 720),
                       'drawable-land-xxhdpi': (1600, 960), 'drawable-land-xxxhdpi': (1920, 1280), 'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800),
                       'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600), 'drawable-port-xxxhdpi': (1280, 1920)}.items():
    save(splash(w, h), f'{RES}/{folder}/splash.png')

# iPhone app icon (no transparency allowed) and launch screen
XC = 'ios/App/App/Assets.xcassets'
save(mark(1024, 0.12, 'square'), f'{XC}/AppIcon.appiconset/AppIcon-512@2x.png', rgb=True)
for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    save(splash(2732, 2732), f'{XC}/Splash.imageset/{name}')
print('Images written')
