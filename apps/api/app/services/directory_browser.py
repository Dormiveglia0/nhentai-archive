import multiprocessing
import os
import threading
from pathlib import Path

_lock = threading.Lock()
_processes = []


def _list(connection, path: str):
    try:
        root = Path(path).resolve(strict=True)
        if not root.is_dir() or any(root == Path(p) or Path(p) in root.parents for p in ("/proc", "/sys", "/dev")):
            raise ValueError("不能浏览该目录")
        entries = []
        truncated = False
        with os.scandir(root) as iterator:
            for index, entry in enumerate(iterator):
                if index >= 2000:
                    truncated = True
                    break
                if entry.name.startswith(".") or (root == Path("/") and entry.name in {"proc", "sys", "dev"}):
                    continue
                try:
                    if entry.is_dir(follow_symlinks=False):
                        entries.append({"name": entry.name, "path": str(root / entry.name)})
                except OSError:
                    continue
                if len(entries) >= 200:
                    truncated = True
                    break
        connection.send({"path": str(root), "parent": str(root.parent), "result": sorted(entries, key=lambda e: e["name"].casefold()), "truncated": truncated})
    except (OSError, ValueError) as exc:
        connection.send({"error": str(exc)[:300]})
    finally:
        connection.close()


def browse_directories(path: str = "/"):
    if not isinstance(path, str) or len(path) > 4096 or "\x00" in path or not Path(path).is_absolute():
        raise ValueError("请输入绝对目录路径")
    # ponytail: two disposable workers bound slow mount IO; no process pool needed for directory picking.
    with _lock:
        _processes[:] = [process for process in _processes if process.is_alive()]
        if len(_processes) >= 2:
            raise ValueError("目录浏览繁忙，请稍后重试")
        context = multiprocessing.get_context("spawn")
        connection, child = context.Pipe(duplex=False)
        process = context.Process(target=_list, args=(child, path), daemon=True)
        process.start()
        child.close()
        _processes.append(process)
    try:
        if not connection.poll(5):
            raise ValueError("目录读取超时，可重试或手动填写路径")
        result = connection.recv()
        if "error" in result:
            raise ValueError(result["error"])
        return result
    except EOFError as exc:
        raise ValueError("无法读取目录") from exc
    finally:
        connection.close()
        process.join(.2)
        if process.is_alive():
            process.terminate()
            process.join(.2)
        if process.is_alive():
            process.kill()
            process.join(.2)
