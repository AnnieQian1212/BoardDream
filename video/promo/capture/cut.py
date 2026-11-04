"""Cuts the one-take screen recording into the film's clips, each re-timed in ffmpeg (a sped-up
stretch keeps every Nth frame, a time-lapse of the real run) and encoded with a short keyframe
interval so Remotion seeks into it fast.

    python video/promo/capture/cut.py            # all clips in cuts.json
    python video/promo/capture/cut.py making-a   # just these

cuts.json: [{"name": "making-a", "src": "film.mp4", "from": 61.2, "to": 300.0, "speed": 40}, ...] in seconds
of a take in public/footage (film.mp4 when src is left out); marks are in the take logs.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FOOTAGE = os.path.join(ROOT, "footage-raw")
OUT = os.path.join(ROOT, "public", "footage", "clips")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def cut(c):
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, c["name"] + ".mp4")
    src = os.path.join(FOOTAGE, c.get("src", "film.mp4"))
    speed = float(c.get("speed", 1))
    vf = f"setpts=(PTS-STARTPTS)/{speed},fps=60"
    if c.get("crop"):
        x, y, w, h = c["crop"]
        vf += f",crop={w}:{h}:{x}:{y}"
    args = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(c["from"]), "-t", str(c["to"] - c["from"]), "-i", src,
            "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", "30", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", out]
    r = subprocess.run(args, capture_output=True, text=True)
    dur = (c["to"] - c["from"]) / speed
    return f'{c["name"]}: {"ok" if r.returncode == 0 else "FAILED " + r.stderr[-300:]} ({dur:.2f} s)'


if __name__ == "__main__":
    cuts = json.load(open(os.path.join(HERE, "cuts.json"), encoding="utf-8"))
    want = sys.argv[1:]
    todo = [c for c in cuts if not want or c["name"] in want]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for line in pool.map(cut, todo):
            print(line, flush=True)
