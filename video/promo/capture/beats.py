import sys, numpy as np, librosa
from scipy.signal import butter, sosfilt
path = sys.argv[1]
y, sr = librosa.load(path, sr=None, mono=True)
dur = len(y)/sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, tightness=400, units="time")
i = np.arange(len(beats)); A = np.vstack([i, np.ones_like(i)]).T
(T, t0), *_ = np.linalg.lstsq(A, beats, rcond=None)
res = beats - (t0 + i*T)
print(f"{path.split('/')[-1]} dur={dur:.2f}s BPM={60/T:.3f} t0={t0:.4f} T={T:.5f} resid max={np.abs(res).max()*1000:.0f}ms p90={np.percentile(np.abs(res),90)*1000:.0f}ms")
# energy per bar (4 beats) to find structure
rms = librosa.feature.rms(y=y, hop_length=512)[0]; tt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
def band_env(lo, hi):
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    return librosa.onset.onset_strength(y=sosfilt(sos, y), sr=sr)
kick = band_env(40,160); kt = librosa.frames_to_time(np.arange(len(kick)), sr=sr)
bar = 4*T
nb = int((dur - t0)//bar)
print("bar  start   rms   kick")
for b in range(nb):
    s = t0 + b*bar; e = s + bar
    m = (tt>=s)&(tt<e); km = (kt>=s)&(kt<e)
    print(f"{b+1:3d} {s:6.2f} {rms[m].mean():.3f} {kick[km].mean():.2f}")
