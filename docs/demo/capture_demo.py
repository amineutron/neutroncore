"""Regenere les captures du README (docs/screenshots/*.jpg) et le GIF (docs/assets/demo.gif)
depuis le build de DEMO : donnees fictives, aucune cle API, aucune donnee de la machine.

Prerequis : npm run build:demo (dossier dist-demo/) ; Google Chrome.
Lancer :    uv run --with playwright --with pillow python docs/demo/capture_demo.py

Les captures de l'application reelle restent possibles avec record.py (donnees reelles :
a relire avant de les publier)."""
import functools
import http.server
import tempfile
import threading
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist-demo"
SHOTS = ROOT / "docs" / "screenshots"
GIF = ROOT / "docs" / "assets" / "demo.gif"
BG = (14, 10, 16)  # --bg du theme neutron

# localStorage : pas d'animation de demarrage ni de tutoriel sur les captures
PREPARE = """() => {
  localStorage.setItem('neutroncore_last_visit', String(Date.now()));
  localStorage.setItem('neutroncore_settings', JSON.stringify({ bootAnim: false, welcomeAnim: false }));
  localStorage.setItem('neutroncore_tour_v1', '1');
  localStorage.setItem('neutroncore_projects_open', JSON.stringify(['lyra']));
}"""


def serve() -> tuple[http.server.ThreadingHTTPServer, str]:
    """Sert dist-demo/ sous /neutroncore/, comme GitHub Pages."""
    assert (DIST / "index.html").exists(), "lancer d'abord : npm run build:demo"
    root = Path(tempfile.mkdtemp())
    (root / "neutroncore").symlink_to(DIST)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):  # pas de journal par requete
            pass

        def handle(self):  # le navigateur annule des requetes en changeant d'ecran
            try:
                super().handle()
            except (BrokenPipeError, ConnectionResetError):
                pass

    handler = functools.partial(Quiet, directory=str(root))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_port}/neutroncore/"


def open_page(browser, url: str, width: int, height: int, scale: int):
    ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=scale, color_scheme="dark")
    page = ctx.new_page()
    page.goto(url, wait_until="domcontentloaded")
    page.evaluate(PREPARE)
    return page


def goto(page, url: str, screen: str, wait: float = 2.5) -> None:
    page.goto(f"{url}?screen={screen}", wait_until="networkidle")
    time.sleep(wait)


def save_jpg(png: bytes, path: Path) -> None:
    tmp = path.with_suffix(".png")
    tmp.write_bytes(png)
    Image.open(tmp).convert("RGB").save(path, quality=85, optimize=True)
    tmp.unlink()
    print("capture", path.relative_to(ROOT))


def main() -> None:
    httpd, url = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        # ordinateur : 1280x820 en x2 (2560x1640, comme les captures precedentes)
        page = open_page(browser, url, 1280, 820, 2)
        for screen, name in (("accueil", "accueil"), ("outils", "outils"), ("parametres", "parametres")):
            goto(page, url, screen)
            save_jpg(page.screenshot(), SHOTS / f"{name}.jpg")
        # telephone : deux ecrans 440x900 en x2, cote a cote
        phone = open_page(browser, url, 440, 900, 2)
        halves = []
        for screen in ("accueil", "outils"):
            goto(phone, url, screen)
            tmp = SHOTS / f"_{screen}.png"
            tmp.write_bytes(phone.screenshot())
            halves.append(Image.open(tmp).convert("RGB"))
            tmp.unlink()
        gap = 40
        w, h = halves[0].size
        both = Image.new("RGB", (w * 2 + gap, h), BG)
        both.paste(halves[0], (0, 0))
        both.paste(halves[1], (w + gap, 0))
        both.save(SHOTS / "mobile.jpg", quality=85, optimize=True)
        print("capture", (SHOTS / "mobile.jpg").relative_to(ROOT))
        # GIF : parcours de l'app en 1180x760
        gif_page = open_page(browser, url, 1180, 760, 1)
        frames = []
        for screen, wait, scroll in (("accueil", 2.5, 0), ("projets", 3, 0), ("projets", 3, 500), ("taches", 2.5, 0),
                                     ("ambiance", 2.5, 0), ("lanceur", 2.5, 0)):
            goto(gif_page, url, screen, wait)
            if scroll:
                gif_page.mouse.wheel(0, scroll)
                time.sleep(1.2)
            tmp = GIF.with_name(f"frame-{len(frames):02d}.png")
            tmp.write_bytes(gif_page.screenshot())
            frames.append(tmp)
        imgs = [Image.open(f).convert("P", palette=Image.ADAPTIVE, colors=128) for f in frames]
        imgs[0].save(GIF, save_all=True, append_images=imgs[1:], duration=[2200] * len(imgs), loop=0, optimize=True)
        for f in frames:
            f.unlink()
        print("gif", GIF.relative_to(ROOT), GIF.stat().st_size, "octets", len(imgs), "images")
        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
