"""Regenere docs/assets/demo.gif : captures reelles de la PWA servie par lyra-control-api (Chrome sans
fenetre via Playwright), assemblees avec Pillow. La cle API est lue dans ~/.lyra-control.env et injectee
dans localStorage sans jamais etre affichee. Prerequis : pip install playwright pillow ; Google Chrome.
Lancer : python3 docs/demo/record.py"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "assets" / "demo.gif"
key = ""
for line in Path.home().joinpath(".lyra-control.env").read_text().splitlines():
    if line.startswith("LYRA_CONTROL_API_KEY="):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
assert key, "clé absente"
frames = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": 1180, "height": 760}, device_scale_factor=1, color_scheme="dark")
    page = ctx.new_page()
    page.goto("http://127.0.0.1:9876/app/", wait_until="domcontentloaded")
    page.evaluate("""([k, ts]) => {
        localStorage.setItem('neutroncore_api_key', k);
        localStorage.setItem('neutroncore_last_visit', String(ts));
        const s = JSON.parse(localStorage.getItem('neutroncore_settings') || '{}');
        s.bootAnim = false; s.welcomeAnim = false; localStorage.setItem('neutroncore_settings', JSON.stringify(s));
        localStorage.setItem('neutroncore_tour_v1', '1');
        localStorage.setItem('neutroncore_projects_open', JSON.stringify(['github-profil']));
    }""", [key, int(time.time() * 1000)])
    page.goto("http://127.0.0.1:9876/app/", wait_until="networkidle")
    time.sleep(2.5)
    def shot(label):
        path = OUT.with_name(f"frame-{len(frames):02d}.png")
        page.screenshot(path=str(path))
        frames.append(path); print("capture", label)
    shot("accueil")
    for screen, wait in (("projets", 3), ("tâches", 2.5), ("ambiance", 2.5), ("lanceur", 2)):
        # navigation par le menu (liens dont le texte correspond)
        link = page.locator(f".nav a:has-text('{screen}')").first
        if link.count():
            link.click(); time.sleep(wait); shot(screen)
            if screen == "projets":
                page.mouse.wheel(0, 500); time.sleep(1.2); shot("projets (suite)")
    browser.close()
imgs = [Image.open(f).convert("P", palette=Image.ADAPTIVE, colors=128) for f in frames]
imgs[0].save(OUT, save_all=True, append_images=imgs[1:], duration=[2200] * len(imgs), loop=0, optimize=True)
for f in frames: f.unlink()
print(OUT, OUT.stat().st_size, "octets", len(imgs), "images")
