# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "watchdog>=4.0.0",
# ]
# ///
"""
douyin_patch_watcher.py

监听抖音安装目录，检测抖音自动更新到新版本后，自动用 patch_preload.ps1
重新注入 fullscreen_payload.js，让全屏 patch + 清屏保持 patch 持续生效。

设计要点：
- watchdog 监听 C:\\Program Files (x86)\\ByteDance\\douyin\\ 递归
- 检测到 preload.js create/modify → 3s 防抖 → 文件大小稳定后才触发 patch
- 只处理"最新版本目录"（按版本号排序的最后一个），忽略旧版本
- 启动时先全量巡检一次（补偿 watcher 没跑时已经发生的更新）
- 每 5 分钟兜底轮询一次
- patch_preload.ps1 自己会为每个版本创建独立备份，安全可重入
- 通过 gsudo 提权（主人的 CLAUDE.md 规则：Access Denied 自动用 gsudo 重试）
- 运行时不需要管理员权限，只有 gsudo 弹窗一次
"""
from __future__ import annotations

import logging
import subprocess
import sys
import threading
import time
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# ── 配置 ─────────────────────────────────────────────────────────────
DOUYIN_ROOT = Path(r"C:\Program Files (x86)\ByteDance\douyin")
REPO_ROOT = Path(r"F:\claude\longterm\douyin-fullscreen-patch")
PATCH_SCRIPT = REPO_ROOT / "patch_preload.ps1"
PAYLOAD_FILE = REPO_ROOT / "fullscreen_payload.js"
LOG_DIR = Path(r"F:\claude\logs")
LOG_FILE = LOG_DIR / "douyin-patch-watcher.log"

# 与 patch_preload.ps1 里 $Marker 保持一致
MARKER = "// ═══ DOUYIN TRUE FULLSCREEN PATCH V2 ═══"

DEBOUNCE_SEC = 3.0
STABLE_MAX_WAIT_SEC = 30.0
STABLE_POLL_SEC = 1.0
POLL_INTERVAL_SEC = 300  # 兜底巡检 5 min
GSUDO_TIMEOUT_SEC = 120

# ── 日志 ─────────────────────────────────────────────────────────────
# pythonw.exe 下 sys.stdout 可能为 None，只在 stdout 可用时挂 StreamHandler
LOG_DIR.mkdir(parents=True, exist_ok=True)
_handlers: list[logging.Handler] = [
    logging.FileHandler(LOG_FILE, encoding="utf-8"),
]
if sys.stdout is not None:
    _handlers.append(logging.StreamHandler(sys.stdout))
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=_handlers,
)
log = logging.getLogger("douyin-watcher")

# ── 工具函数 ─────────────────────────────────────────────────────────

def find_version_dirs() -> list[Path]:
    """返回所有版本目录，按版本号升序"""
    if not DOUYIN_ROOT.exists():
        return []
    versions: list[Path] = []
    for d in DOUYIN_ROOT.iterdir():
        if not d.is_dir():
            continue
        name = d.name
        parts = name.split(".")
        if len(parts) >= 2 and all(p.isdigit() for p in parts[:2]):
            versions.append(d)
    # 字符串版本号排序（7.7.0 > 7.6.0）
    def key(p: Path) -> tuple[int, ...]:
        try:
            return tuple(int(x) for x in p.name.split("."))
        except ValueError:
            return (0,)
    return sorted(versions, key=key)

def preload_path_for(version_dir: Path) -> Path:
    return version_dir / "resources" / "app.asar.unpacked" / "preload.js"

def is_patched(preload_path: Path) -> bool | None:
    if not preload_path.exists():
        return None
    try:
        with open(preload_path, "r", encoding="utf-8", errors="ignore") as f:
            return MARKER in f.read()
    except OSError as e:
        log.error(f"读 preload.js 失败: {preload_path} - {e}")
        return None

def wait_for_stable(path: Path, max_wait: float = STABLE_MAX_WAIT_SEC) -> bool:
    """等待文件大小连续 2 次相同 = 写入完成"""
    if not path.exists():
        return False
    last_size = -1
    stable_count = 0
    start = time.time()
    while time.time() - start < max_wait:
        try:
            size = path.stat().st_size
            if size == last_size and size > 0:
                stable_count += 1
                if stable_count >= 2:
                    return True
            else:
                stable_count = 0
                last_size = size
        except OSError:
            pass
        time.sleep(STABLE_POLL_SEC)
    return False

# ── 核心：调用 patch 脚本 ────────────────────────────────────────────

_patch_lock = threading.Lock()

def run_patch_script(version_dir: Path) -> bool:
    """gsudo 提权调用 patch_preload.ps1"""
    preload = preload_path_for(version_dir)
    if not preload.exists():
        log.error(f"preload.js 不存在: {preload}")
        return False
    if not PATCH_SCRIPT.exists():
        log.error(f"patch 脚本不存在: {PATCH_SCRIPT}")
        return False
    if not PAYLOAD_FILE.exists():
        log.error(f"payload 不存在: {PAYLOAD_FILE}")
        return False

    log.info(f"等待 {preload.name} 写入稳定...")
    if not wait_for_stable(preload):
        log.warning(f"{preload.name} 未在 {STABLE_MAX_WAIT_SEC}s 内稳定，继续尝试")

    cmd = [
        "gsudo",
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", str(PATCH_SCRIPT),
    ]
    log.info(f"执行 patch_preload.ps1 for {version_dir.name}")
    try:
        result = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=GSUDO_TIMEOUT_SEC,
        )
    except FileNotFoundError:
        log.error("找不到 gsudo，请确认已安装（scoop install gsudo）")
        return False
    except subprocess.TimeoutExpired:
        log.error(f"patch 执行超时 ({GSUDO_TIMEOUT_SEC}s)")
        return False

    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if result.returncode == 0:
        log.info(f"patch 成功: {version_dir.name}")
        if stdout:
            for line in stdout.splitlines():
                log.info(f"  | {line}")
        return True
    log.error(f"patch 失败 rc={result.returncode}")
    if stdout:
        log.error(f"stdout: {stdout}")
    if stderr:
        log.error(f"stderr: {stderr}")
    return False

def check_and_patch_all() -> None:
    with _patch_lock:
        versions = find_version_dirs()
        if not versions:
            log.warning(f"找不到任何版本目录: {DOUYIN_ROOT}")
            return
        latest = versions[-1]
        log.info(f"巡检最新版本: {latest.name}")
        preload = preload_path_for(latest)
        patched = is_patched(preload)
        if patched is True:
            log.info(f"{latest.name}: 已打补丁，跳过")
        elif patched is False:
            log.info(f"{latest.name}: 未打补丁，触发注入")
            run_patch_script(latest)
        else:
            log.warning(f"{latest.name}: preload.js 不可读，稍后再试")

# ── watchdog handler ────────────────────────────────────────────────

class DouyinUpdateHandler(FileSystemEventHandler):
    def __init__(self) -> None:
        super().__init__()
        self._timer: threading.Timer | None = None

    def _schedule(self, reason: str) -> None:
        if self._timer is not None:
            self._timer.cancel()
        self._timer = threading.Timer(DEBOUNCE_SEC, self._fire, args=[reason])
        self._timer.daemon = True
        self._timer.start()

    def _fire(self, reason: str) -> None:
        log.info(f"防抖触发巡检: {reason}")
        try:
            check_and_patch_all()
        except Exception:
            log.exception("check_and_patch_all 异常")

    def on_created(self, event):
        path = event.src_path
        if not event.is_directory and "preload.js" not in path:
            return
        self._schedule(f"created {path}")

    def on_modified(self, event):
        if event.is_directory:
            return
        path = event.src_path
        if path.endswith("preload.js"):
            self._schedule(f"modified {path}")

    def on_moved(self, event):
        path = getattr(event, "dest_path", event.src_path)
        if "preload.js" in path or event.is_directory:
            self._schedule(f"moved {path}")

# ── 主入口 ───────────────────────────────────────────────────────────

def main() -> int:
    log.info("=" * 60)
    log.info("douyin_patch_watcher 启动")
    log.info(f"DOUYIN_ROOT:  {DOUYIN_ROOT}")
    log.info(f"REPO_ROOT:    {REPO_ROOT}")
    log.info(f"PATCH_SCRIPT: {PATCH_SCRIPT}")
    log.info(f"PAYLOAD_FILE: {PAYLOAD_FILE}")
    log.info(f"LOG_FILE:     {LOG_FILE}")

    if not DOUYIN_ROOT.exists():
        log.error("抖音安装目录不存在，退出")
        return 1
    if not PATCH_SCRIPT.exists():
        log.error(f"patch 脚本不存在: {PATCH_SCRIPT}")
        return 1

    # 启动时立即巡检一次（补偿 watcher 没跑时已发生的更新）
    try:
        check_and_patch_all()
    except Exception:
        log.exception("启动巡检异常")

    observer = Observer()
    observer.schedule(DouyinUpdateHandler(), str(DOUYIN_ROOT), recursive=True)
    observer.start()
    log.info(f"watchdog 开始监听: {DOUYIN_ROOT}")

    last_poll = time.time()
    try:
        while True:
            time.sleep(10)
            if time.time() - last_poll > POLL_INTERVAL_SEC:
                try:
                    check_and_patch_all()
                except Exception:
                    log.exception("兜底巡检异常")
                last_poll = time.time()
    except KeyboardInterrupt:
        log.info("收到 Ctrl+C，停止")
    finally:
        observer.stop()
        observer.join()
    log.info("退出")
    return 0

if __name__ == "__main__":
    sys.exit(main())
