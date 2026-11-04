# Pieces of every feature for the end card's group photo, cut from the app's stills (public/cap,
# 2x pixels) into public/shots/outro. Boxes are CSS pixels of the 1920 x 1080 page.
#   python src/shots/outro/crop.py
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, "..", "..", "..", "public", "cap")
OUT = os.path.join(HERE, "..", "..", "..", "public", "shots", "outro")
os.makedirs(OUT, exist_ok=True)

def exists(n): return os.path.exists(os.path.join(CAP, n + ".png"))

def cut(still, name, x, y, w, h):
    im = Image.open(os.path.join(CAP, still + ".png"))
    im.crop((2 * x, 2 * y, 2 * (x + w), 2 * (y + h))).save(os.path.join(OUT, name + ".png"))
    return {"name": name, "still": still, "w": w, "h": h}

pieces = []
# the made game's board: painted if the painting is in, else as first drawn
board_still = "table-painted" if exists("table-painted") else "table-made"
pieces.append(cut(board_still, "board", 515, 70, 600, 540))
# the made game taking shape (title card on the making screen)
pieces.append(cut("making-136", "making", 486, 70, 680, 138))
# the left rail: the rules written as code and the playtest
pieces.append(cut("making-136", "steps", 14, 54, 218, 634))
# a card in hand
pieces.append(cut("cloudwaft-1", "card", 886, 788, 148, 206))
# the mochi steamer and its blanket
pieces.append(cut("mochi-3", "mochi", 498, 946, 506, 118))
# the friends' table
pieces.append(cut("friends-host-joined", "room", 750, 101, 420, 508))
# Behind the scenes: the four measured numbers
pieces.append(cut("results-0", "stats", 578, 78, 764, 118))
# the idea box
pieces.append(cut("home-typed", "idea", 630, 387, 660, 194))
if exists("print-1"):  # the print-and-play kit: the painted board on its A4 page
    pieces.append(cut("print-1", "print", 758, 68, 404, 508))
json.dump({"background": board_still, "pieces": pieces}, open(os.path.join(OUT, "pieces.json"), "w"), indent=1)
print([p["name"] for p in pieces], board_still)
