import os
import runpy
import sys
import sysconfig
from pathlib import Path

WORK = Path(os.environ["RENDER_WORK"]).resolve()
DESIGN = Path(os.environ["AWS_DESIGN_SYSTEM_DIR"]).resolve()

# Discover package directories for the Python interpreter in use.
_python_paths = sysconfig.get_paths()
SITE_PACKAGES = tuple(
    Path(path).resolve()
    for key in ("purelib", "platlib")
    if (path := _python_paths.get(key))
)

READ_ROOTS = tuple(dict.fromkeys(
    p for p in (
        WORK,
        DESIGN,
        *SITE_PACKAGES,
        Path("/usr"),
        Path("/lib"),
        Path("/lib64"),
        Path("/etc/fonts"),
        Path("/var/cache/fontconfig"),
    ) if p.exists()
))
BLOCKED_IMPORTS = {"ctypes", "socket", "multiprocessing", "http", "urllib", "ftplib", "telnetlib"}

# CairoSVG is trusted and must load before the audit hook because cairocffi
# uses ctypes internally. Rendered scripts still cannot import ctypes.
VENDOR = DESIGN / "vendor" / "python"
if VENDOR.is_dir():
    sys.path.insert(0, str(VENDOR))
import cairosvg


def inside(path, roots):
    try:
        resolved = Path(path).resolve()
    except (TypeError, ValueError, OSError):
        return False
    return any(resolved == root or root in resolved.parents for root in roots)


def require_work(path):
    if not inside(path, (WORK,)):
        raise PermissionError(f"writing outside the job directory is blocked: {path}")


def audit(event, args):
    if event == "import" and args and str(args[0]).split(".", 1)[0] in BLOCKED_IMPORTS:
        raise PermissionError(f"blocked module: {args[0]}")
    if event.startswith(("socket.", "subprocess.", "os.exec", "os.spawn", "pty.spawn")) or event == "os.system":
        raise PermissionError(f"blocked operation: {event}")
    if event == "open" and args and isinstance(args[0], (str, bytes, os.PathLike)):
        mode = args[1] if len(args) > 1 and isinstance(args[1], str) else "r"
        flags = args[2] if len(args) > 2 and isinstance(args[2], int) else 0
        writing = any(flag in mode for flag in "wax+") or bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND))
        if writing:
            require_work(args[0])
        elif not inside(args[0], READ_ROOTS):
            raise PermissionError(f"read outside allowed roots: {args[0]}")
    if event in {"os.listdir", "os.scandir"} and args:
        path = args[0] if args[0] is not None else "."
        if not inside(path, READ_ROOTS):
            raise PermissionError(f"listagem bloqueada: {path}")
    if event in {"os.remove", "os.rmdir", "os.mkdir", "os.chmod", "os.chown", "os.truncate"} and args:
        require_work(args[0])
    if event in {"os.rename", "os.replace"} and len(args) >= 2:
        require_work(args[0])
        require_work(args[1])
    if event in {"os.symlink", "os.link"}:
        raise PermissionError(f"links bloqueados: {event}")


sys.addaudithook(audit)

# Compatibility for APIs removed in Pillow 10.
from PIL import Image, ImageDraw, ImageFont


def _font_getsize(self, text, *args, **kwargs):
    left, top, right, bottom = self.getbbox(text, *args, **kwargs)
    return right - left, bottom - top


for _font_class_name in ("ImageFont", "FreeTypeFont", "TransposedFont"):
    _font_class = getattr(ImageFont, _font_class_name, None)
    if _font_class is not None and not hasattr(_font_class, "getsize") and hasattr(_font_class, "getbbox"):
        setattr(_font_class, "getsize", _font_getsize)

if not hasattr(ImageDraw.ImageDraw, "textsize"):
    def _draw_textsize(self, text, font=None, *args, **kwargs):
        left, top, right, bottom = self.textbbox((0, 0), text, font, *args, **kwargs)
        return right - left, bottom - top
    ImageDraw.ImageDraw.textsize = _draw_textsize

if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

if len(sys.argv) != 2:
    raise SystemExit("uso interno: audit_guard.py SCRIPT")
target = Path(sys.argv[1]).resolve()
require_work(target)
runpy.run_path(str(target), run_name="__main__")
