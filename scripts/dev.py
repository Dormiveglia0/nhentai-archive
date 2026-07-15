from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = [
    str(ROOT / ".venv/bin/uvicorn"),
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8001",
    "--reload",
    "--reload-dir",
    str(ROOT / "backend"),
]
FRONTEND = [
    "npm",
    "--prefix",
    str(ROOT / "frontend"),
    "run",
    "dev",
    "--",
    "--port",
    "5173",
    "--strictPort",
]


def check() -> list[str]:
    missing = []
    if not os.access(BACKEND[0], os.X_OK):
        missing.append("缺少 .venv/bin/uvicorn，请先安装后端依赖。")
    if shutil.which("npm") is None:
        missing.append("缺少 npm。")
    if not (ROOT / "frontend/node_modules").is_dir():
        missing.append("缺少 frontend/node_modules，请先运行 npm --prefix frontend install。")
    return missing


def stop(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except ProcessLookupError:
        return
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def interrupt(*_args) -> None:
    raise KeyboardInterrupt


def main() -> int:
    if sys.argv[1:] not in ([], ["--check"]):
        print("usage: python3 scripts/dev.py [--check]", file=sys.stderr)
        return 2

    missing = check()
    if missing:
        print("\n".join(missing), file=sys.stderr)
        return 1
    if sys.argv[1:] == ["--check"]:
        print("统一开发启动环境正常。")
        return 0

    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join(
        part for part in (str(ROOT / "backend"), env.get("PYTHONPATH")) if part
    )
    env.setdefault("VITE_API_PROXY_TARGET", "http://127.0.0.1:8001")
    processes: list[subprocess.Popen] = []

    try:
        signal.signal(signal.SIGTERM, interrupt)
        for command in (BACKEND, FRONTEND):
            processes.append(
                subprocess.Popen(command, cwd=ROOT, env=env, start_new_session=True)
            )
        print("NH Archive 开发环境：http://127.0.0.1:5173", flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.2)
        return next(process.returncode for process in processes if process.returncode is not None)
    except KeyboardInterrupt:
        return 130
    finally:
        for process in processes:
            stop(process)


if __name__ == "__main__":
    raise SystemExit(main())
