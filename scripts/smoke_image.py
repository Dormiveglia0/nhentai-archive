"""Check the production Compose image with disposable data, never a user's library."""

import http.cookiejar
import json
from pathlib import Path
import secrets
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 scripts/smoke_image.py IMAGE")

    with TemporaryDirectory(prefix="nh-image-smoke-") as temporary:
        storage = Path(temporary) / "data"
        storage.mkdir(mode=0o700)
        project = f"nh-smoke-{storage.parent.name}"
        source = (ROOT / "compose.yaml").read_text()
        replacements = {
            "name: nh-archive": f"name: {project}",
            "container_name: nh-archive": f"container_name: {project}",
            "image: ghcr.io/dormiveglia0/nhentai-archive:latest": f"image: {json.dumps(sys.argv[1])}",
            '      - "4349:8000"': '      - "127.0.0.1:0:8000"',
            "      - ./data:/data": f"      - {storage}:/data",
        }
        for old, new in replacements.items():
            if old not in source:
                raise AssertionError(f"Compose smoke template changed: {old}")
            source = source.replace(old, new, 1)
        smoke_compose = Path(temporary) / "compose.yaml"
        smoke_compose.write_text(source)
        compose = ["docker", "compose", "-f", str(smoke_compose)]

        def run(*args: str) -> str:
            return subprocess.check_output([*compose, *args], text=True).strip()

        try:
            run("up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "90")
            base = "http://" + run("port", "app", "8000")
            client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

            def request(path: str, payload: dict | None = None) -> tuple[int, bytes]:
                req = urllib.request.Request(
                    base + path,
                    data=json.dumps(payload).encode() if payload is not None else None,
                    headers={"Content-Type": "application/json"} if payload is not None else {},
                )
                try:
                    with client.open(req, timeout=5) as response:
                        return response.status, response.read()
                except urllib.error.HTTPError as error:
                    return error.code, error.read()

            assert request("/api/health") == (200, b'{"status":"ok"}')
            status, html = request("/")
            assert status == 200 and b"/assets/" in html
            assert request("/icon.svg")[0] == 200
            # CI downloads the separate web build; local Docker-only checkouts may have no dist.
            dist = ROOT / "apps/web/dist"
            if dist.is_dir():
                assert (dist / "index.html").is_file()
                for file in dist.rglob("*"):
                    if file.is_file():
                        assert request("/" + file.relative_to(dist).as_posix()) == (200, file.read_bytes()), file.name
            assert request("/api/works")[0] == 401
            assert request("/api/auth/setup", {"password": secrets.token_urlsafe(24)})[0] == 200
            assert json.loads(request("/api/works")[1]) == {"result": []}
            assert (storage / "archive.db").is_file()

            run("restart", "app")
            base = "http://" + run("port", "app", "8000")
            for _ in range(60):
                try:
                    if request("/api/health")[0] == 200:
                        break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(0.5)
            else:
                raise AssertionError("Image did not restart")

            auth = json.loads(request("/api/auth/status")[1])
            assert auth["configured"] and auth["authenticated"], "Password/session must survive restart"
            assert request("/api/works")[0] == 200
            assert request("/api/auth/logout", {})[0] == 200
            assert request("/api/works")[0] == 401
            print("Compose smoke passed: web assets, authentication, SQLite persistence, restart and logout")
        except Exception:
            print(run("logs", "--tail", "40"), file=sys.stderr)
            raise
        finally:
            run("down", "--timeout", "10")


if __name__ == "__main__":
    main()
