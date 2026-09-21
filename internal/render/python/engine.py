"""Versioned renderer: editorial JSON and a recorded seed drive composition.

Standalone: python internal/render/python/engine.py campaign.json output-dir
The Go binary embeds this exact source; no model-generated Python is executed.
"""
import base64
import hashlib
import io
import json
import math
import os
from pathlib import Path
import random
import re
import struct
import sys
import unicodedata
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

VERSION = "5.2.0"
FORMATS = {
    "instagram-portrait": (1080, 1350), "instagram-square": (1080, 1080),
    "instagram-story": (1080, 1920), "linkedin-portrait": (1080, 1350),
    "linkedin-document": (1080, 1350), "x-landscape": (1600, 900),
    "facebook-portrait": (1200, 1500), "youtube-community": (1080, 1080),
}
COLORS = {"ink": "#161D26", "paper": "#F8F8FA", "white": "#FFFFFF", "line_dark": "#2B3542",
          "line_light": "#DEDEE3", "green": "#00E582", "pink": "#FF57E9", "blue": "#42B4FF",
          "purple": "#AD5CFF", "orange": "#FF9900"}
GRID_MODULES = {1080: 120, 1200: 120, 1600: 100}


def normalize(value):
    table = {0x2011: "-", 0x2010: "-", 0x2013: "-", 0x2014: "-", 0x00A0: " ",
             0x202F: " ", 0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"', 0x2026: "..."}
    return unicodedata.normalize("NFC", value.translate(table)).strip()


@lru_cache(maxsize=16)
def coverage(path):
    """Read Unicode cmap (4/12) with stdlib; prevent silent .notdef glyphs."""
    data = Path(path).read_bytes()
    u16 = lambda pos: struct.unpack_from(">H", data, pos)[0]
    u32 = lambda pos: struct.unpack_from(">I", data, pos)[0]
    cmap = None
    for pos in range(12, 12 + u16(4) * 16, 16):
        if data[pos:pos+4] == b"cmap":
            cmap = u32(pos+8)
            break
    chars = set()
    if cmap is None:
        return chars
    for pos in range(cmap+4, cmap+4+8*u16(cmap+2), 8):
        platform, encoding = u16(pos), u16(pos+2)
        if platform != 0 and not (platform == 3 and encoding in (1, 10)):
            continue
        offset = cmap + u32(pos+4)
        if u16(offset) == 12:
            for j in range(u32(offset+12)):
                start, end, glyph = struct.unpack_from(">III", data, offset+16+j*12)
                chars.update(range(start + (glyph == 0), end+1))
        elif u16(offset) == 4:
            count = u16(offset+6)//2
            ends = offset+14
            starts = ends+2*count+2
            deltas = starts+2*count
            ranges = deltas+2*count
            for j in range(count):
                start, end = u16(starts+2*j), u16(ends+2*j)
                delta, distance = u16(deltas+2*j), u16(ranges+2*j)
                for cp in range(start, min(end, 65534)+1):
                    if distance:
                        glyph = u16(ranges+2*j+distance+2*(cp-start))
                        if glyph: glyph = (glyph+delta) & 65535
                    else:
                        glyph = (cp+delta) & 65535
                    if glyph: chars.add(cp)
    return chars


def font_path(text, bold=False):
    suffix = "Bold" if bold else "Regular"
    dejavu = "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"
    paths = [f"/usr/share/fonts/truetype/ibm-plex/IBMPlexMono-{suffix}.ttf",
             f"/usr/share/fonts/truetype/dejavu/{dejavu}", f"/usr/share/fonts/dejavu/{dejavu}",
             f"/usr/share/fonts/TTF/{dejavu}"]
    needed = {ord(c) for c in text if not c.isspace()}
    for path in paths:
        if Path(path).is_file() and needed.issubset(coverage(path)):
            return path
    missing = " ".join(f"U+{cp:04X}" for cp in sorted(needed - set().union(*(coverage(p) for p in paths if Path(p).is_file()))))
    raise ValueError(f"Font unavailable or characters have no glyph ({missing}). Revise the text.")


@lru_cache(maxsize=512)
def face(path, size):
    return ImageFont.truetype(path, size)


def wrap(text, font, width):
    if width <= 0: raise ValueError("Text box has no width")
    lines = []
    fits = lambda s: font.getlength(s) <= width and font.getbbox(s)[2]-font.getbbox(s)[0] <= width
    for paragraph in text.split("\n"):
        current = ""
        for word in paragraph.split():
            trial = (current + " " + word).strip()
            if fits(trial):
                current = trial
                continue
            if current: lines.append(current)
            current = ""
            for char in word:
                if current and not fits(current+char):
                    lines.append(current)
                    current = ""
                if not fits(char): raise ValueError("A character exceeds the available width")
                current += char
        lines.append(current)
    return "\n".join(lines)


def overlap(a, b):
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


def inset(box, p):
    return (box[0]+p, box[1]+p, box[2]-p, box[3]-p)


@lru_cache(maxsize=8)
def icon_catalog(design):
    root=Path(design).resolve()
    source_root=root/"icon_sources"
    intents={path.stem: str(path.relative_to(root)) for path in source_root.rglob("*.svg")}
    aliases={"audio":"audio-waveform", "brackets":"code", "chat":"message", "chip":"cpu", "community":"users",
             "connector":"link", "droplet":"circle", "hashtag":"hash", "lightning":"zap",
             "play-target":"target"}
    for alias,target in aliases.items():
        if target in intents:
            intents[alias]=intents[target]
    if not intents:
        raise ValueError("Icon catalog is empty")
    return intents


@lru_cache(maxsize=2048)
def icon_mask(design, intent):
    root=Path(design).resolve()
    relative=icon_catalog(str(root)).get(intent)
    if not relative:
        raise ValueError(f"Unknown icon intent: {intent}")
    path=(root/relative).resolve()
    if root not in path.parents or not path.is_file():
        raise ValueError(f"Invalid icon source: {intent}")
    if path.suffix.lower()!=".svg":
        raise ValueError(f"Icon source is not SVG: {intent}")
    try:
        from cairosvg import svg2png
    except ImportError as error:
        raise ValueError("CairoSVG is unavailable for rasterizing Pixelarticons") from error
    raster=svg2png(bytestring=path.read_bytes(),output_width=96,output_height=96)
    with Image.open(io.BytesIO(raster)) as source:
        return source.convert("RGBA").getchannel("A").copy()


class Page:
    def __init__(self, width, height, dark, design, number, accent_name=None):
        self.w, self.h, self.dark, self.design, self.number = width, height, dark, design, number
        # Coarse modular grid: nine columns at the primary 1080px formats.
        # The module stays integral so every structural cell remains square.
        self.g = GRID_MODULES.get(width,max(1,width//9))
        # Landscape width is not extra vertical space for larger type.
        self.scale = max(1, min(width, height)/1080)
        self.bg = COLORS["ink" if dark else "paper"]
        self.fg = COLORS["white" if dark else "ink"]
        self.line = COLORS["line_dark" if dark else "line_light"]
        self.accent_name = accent_name or ["green", "pink", "blue", "purple", "orange"][(number-1)%5]
        self.accent = COLORS[self.accent_name]
        self.image = Image.new("RGB", (width, height), self.bg)
        self.draw = ImageDraw.Draw(self.image)
        self.regions = {"canvas": {"box": (0, 0, width, height), "parent": None, "kind": "canvas"}}
        self.texts, self.squares = [], []
        self.grid_x = list(range(0, width+1, self.g))
        self.grid_y = list(range(0, height+1, self.g))
        for x in self.grid_x: self.draw.line((x, 0, x, height-1), fill=self.line, width=2)
        for y in self.grid_y: self.draw.line((0, y, width-1, y), fill=self.line, width=2)

    def reserve(self, name, box, parent="canvas", kind="region"):
        box = tuple(round(v) for v in box)
        if name in self.regions: raise ValueError(f"Repeated region: {name}")
        outer = self.regions[parent]["box"]
        if not (outer[0] <= box[0] < box[2] <= outer[2] and outer[1] <= box[1] < box[3] <= outer[3]):
            raise ValueError(f"Page {self.number}: {name} is outside {parent}: {box}")
        for key, region in self.regions.items():
            if region["parent"] == parent and overlap(box, region["box"]):
                raise ValueError(f"Page {self.number}: collision between {name} and {key}")
        self.regions[name] = {"box": box, "parent": parent, "kind": kind}
        return box

    def panel(self, name, box, parent="canvas", fill=None, square=False, bordered=True):
        if square:
            side=round(box[2]-box[0])
            box=(round(box[0]),round(box[1]),round(box[0])+side,round(box[1])+side)
        box = self.reserve(name, box, parent)
        if square: self.squares.append(box)
        # Coordinates are half-open, including in paint operations.
        self.draw.rectangle((box[0], box[1], box[2]-1, box[3]-1), fill=fill or self.bg,
                            outline=self.line if bordered else None,width=2 if bordered else 0)
        return box

    def text(self, name, value, box, parent, preferred=32, minimum=22, bold=False, color=None, align="left", valign="top"):
        value = normalize(value)
        if not value: return
        box = self.reserve(name, box, parent, "text")
        path = font_path(value, bold)
        low = max(1, round(minimum*self.scale))
        for size in range(max(low, round(preferred*self.scale)), low-1, -1):
            font = face(path, size)
            txt = wrap(value, font, box[2]-box[0])
            spacing = max(4, round(size*.22))
            bounds = self.draw.multiline_textbbox((0, 0), txt, font=font, spacing=spacing, align=align)
            bw, bh = bounds[2]-bounds[0], bounds[3]-bounds[1]
            if bw <= box[2]-box[0] and bh <= box[3]-box[1]:
                x = box[0]-bounds[0] + ((box[2]-box[0]-bw)/2 if align == "center" else 0)
                y = box[1]-bounds[1]
                if valign == "center":
                    y = box[1] + (box[3]-box[1]-bh)/2 - bounds[1]
                self.draw.multiline_text((x, y), txt, font=font, spacing=spacing, fill=color or self.fg, align=align)
                actual = self.draw.multiline_textbbox((x, y), txt, font=font, spacing=spacing, align=align)
                if actual[0]<box[0]-.01 or actual[1]<box[1]-.01 or actual[2]>box[2]+.01 or actual[3]>box[3]+.01:
                    raise ValueError(f"Page {self.number}: text is outside box {name}")
                self.texts.append({"name":name,"box":box,"bounds":actual,"size":size,"font":Path(path).name,"text":value,"color":color or self.fg})
                return
        raise ValueError(f"Page {self.number}: text does not fit in {name} at the minimum {low}px font. Shorten the content or choose another page type.")

    def asset(self, name, relative, box, parent, square=False, crop=False):
        if square:
            if abs((box[2]-box[0])-(box[3]-box[1]))>.01: raise ValueError(f"Component {name} is not square")
            side=round(box[2]-box[0])
            box=(round(box[0]),round(box[1]),round(box[0])+side,round(box[1])+side)
        box = self.reserve(name, box, parent, "asset")
        w, h = box[2]-box[0], box[3]-box[1]
        if square:
            if w != h: raise ValueError(f"Component {name} is not square")
            self.squares.append(box)
        with Image.open(self.design / relative) as source:
            asset = source.convert("RGBA")
        method = Image.Resampling.NEAREST if "/icons/" in relative else Image.Resampling.LANCZOS
        if crop:
            factor = max(w/asset.width, h/asset.height)
            asset = asset.resize((math.ceil(asset.width*factor), math.ceil(asset.height*factor)), method)
            x, y = (asset.width-w)//2, (asset.height-h)//2
            asset = asset.crop((x,y,x+w,y+h))
        else: asset.thumbnail((w,h), method)
        self.image.paste(asset, (box[0]+(w-asset.width)//2,box[1]+(h-asset.height)//2), asset)

    def icon(self, name, intent, box, parent, variant=None):
        variant = variant or ("white" if self.dark else "ink")
        if variant not in COLORS:
            raise ValueError(f"Unknown icon color: {variant}")
        if abs((box[2]-box[0])-(box[3]-box[1]))>.01:
            raise ValueError(f"Component {name} is not square")
        side=round(box[2]-box[0])
        box=(round(box[0]),round(box[1]),round(box[0])+side,round(box[1])+side)
        box=self.reserve(name,box,parent,"asset")
        self.squares.append(box)
        alpha=icon_mask(str(self.design),intent)
        drawn=alpha.getbbox()
        if drawn: alpha=alpha.crop(drawn)
        source=Image.new("RGBA",alpha.size,COLORS[variant])
        source.putalpha(alpha)
        target=max(1,round(side*.86))
        factor=min(target/source.width,target/source.height)
        source=source.resize((max(1,round(source.width*factor)),max(1,round(source.height*factor))),Image.Resampling.NEAREST)
        self.image.paste(source,(box[0]+(side-source.width)//2,box[1]+(side-source.height)//2),source)

    def label(self, name, value, box, parent, fill):
        box=self.reserve(name,box,parent,"label")
        self.draw.rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=fill)
        self.text(name+"-text",value,inset(box,max(8,(box[3]-box[1])*.18)),name,16,12,True,COLORS["ink"])
        return box

    def report(self, role):
        return {"layoutEngine":"algorithmic-grid", "role":role, "selectedLayout":self.selected_layout,
                "candidateLayouts":self.candidate_layouts, "selectionSeed":self.selection_seed,
                "width":self.w,"height":self.h,"module":self.g, "accent":self.accent_name,"colorMode":self.color_mode,
                "pageTheme":"dark" if self.dark else "light",
                "itemColors":self.item_colors, "blockAllocations":getattr(self,"block_allocations",[]),
                "componentGap":getattr(self,"component_gap",0),
                "titlePosition":getattr(self,"title_position","top"),
                "decorativeBranches":getattr(self,"decorative_branches",[]),
                "layoutScore":getattr(self,"layout_score",None),
                "layoutScoreBreakdown":getattr(self,"layout_score_breakdown",{}),
                "candidateScores":getattr(self,"candidate_scores",[]),
                "compositionBias":getattr(self,"composition_bias","balanced"),
                "titleIconMode":getattr(self,"title_icon_mode","attached"),
                "componentRules":getattr(self,"component_rules",[]),
                "gridX":self.grid_x,"gridY":self.grid_y,"regions":self.regions,"texts":self.texts,"squares":self.squares}

    def text_height(self, value, width, size, bold=False):
        value=normalize(value)
        if not value: return 0
        font=face(font_path(value,bold),round(size*self.scale))
        spacing=max(4,round(size*self.scale*.22))
        bounds=self.draw.multiline_textbbox((0,0),wrap(value,font,width),font=font,spacing=spacing)
        return bounds[3]-bounds[1]


ACCENTS = ["pink", "green", "blue", "orange", "purple"]
MONO_GRADIENTS = {"pink":"pink-to-white", "green":"green-to-white", "blue":"blue-to-white",
                  "orange":"orange-to-white", "purple":"purple-to-white"}
SPECTRUM_GRADIENTS = ["pink-to-orange", "lavender-to-lime", "purple-blue-diagonal", "purple-pink-orange"]


def mix_color(first, second, amount):
    """Blend two design-system colors without introducing an off-palette hue."""
    a=tuple(int(first[i:i+2],16) for i in (1,3,5)); b=tuple(int(second[i:i+2],16) for i in (1,3,5))
    return "#"+"".join(f"{round(one+(two-one)*amount):02X}" for one,two in zip(a,b))


def stable_seed(content, index, seed=0):
    payload=json.dumps(content,sort_keys=True,ensure_ascii=False,separators=(",",":"))
    digest=hashlib.sha256(f"{seed}:{index}:{payload}".encode()).digest()
    return int.from_bytes(digest[:8],"big")


def item_icon(item, fallback):
    if item.get("iconIntent"):
        return item["iconIntent"]
    value=normalize(item.get("title","")+" "+item.get("text","")).lower()
    groups=[(("cloud","serverless"),"cloud"),
            (("database","data","storage","store"),"database"),
            (("server","compute","instance","virtual machine"),"server"),
            (("terminal","command line","shell","console"," cli "),"terminal"),
            (("security","protection","compliance"),"shield"),
            (("processor","hardware","cpu","chip"),"chip"),
            (("branch","merge","pull request","git"),"git-branch"),
            (("bug","debug","error","failure","incident"),"bug"),
            (("artificial intelligence","machine learning","agent","model","bot"),"robot"),
            (("container","package","dependency"),"package"),
            (("chat","message","conversation","comment","feedback"),"chat"),
            (("like","heart","passion","support"),"heart"),
            (("user","profile","account"),"user"),
            (("share","publish"),"share"),
            (("global","world","region","international"),"globe"),
            (("calendar","agenda","event"),"calendar"),
            (("notification","alert","warning"),"bell"),
            (("save","favorite","bookmark"),"bookmark"),
            (("email","newsletter","contact"),"mail"),
            (("hashtag","topic","tag"),"hashtag"),
            (("code","commit","repository","source"),"brackets"),
            (("build","compile","artifact","image"),"connector"),
            (("test","tests","validate","quality","check"),"play-target"),
            (("deploy","delivery","production","automate"),"lightning"),
            (("observe","metric","monitor","signal"),"signal"),
            (("key","access","credential","identity"),"key"),
            (("team","community","people","collaborate"),"community"),
            (("badge","award","achievement","certification"),"trophy")]
    for terms,icon in groups:
        if any(term in value for term in terms): return icon
    return fallback


def required_rows(p, value, width, preferred, bold=False, padding=None):
    if not value: return 0
    padding=p.g/4 if padding is None else padding
    if width<=2*padding: return 1000
    height=p.text_height(value,width-2*padding,preferred,bold)+2*padding
    return max(1,math.ceil(height/p.g))


def campaign_style(seed, requested=None):
    rng=random.Random(seed)
    if requested in ACCENTS:
        return {"mode":"mono","accent":requested}
    if requested=="colorful":
        return {"mode":"spectrum","accent":ACCENTS[rng.randrange(len(ACCENTS))]}
    mode="spectrum" if rng.randrange(2) else "mono"
    accent=ACCENTS[rng.randrange(len(ACCENTS))]
    return {"mode":mode,"accent":accent}


def candidate_specs(content, size, seed, style, appearance="both"):
    rng=random.Random(seed)
    specs=[]
    # These are search attempts, not layout templates. Each one explores different
    # text wraps, rectangle dimensions and free cells using its recorded seed.
    for attempt in range(54):
        accent=style["accent"] if style["mode"]=="mono" else ACCENTS[rng.randrange(len(ACCENTS))]
        colors=[accent]*5
        if style["mode"]=="spectrum":
            colors=ACCENTS.copy(); rng.shuffle(colors)
        specs.append({"attemptSeed":rng.getrandbits(63), "wrapBias":rng.random(),
                      "iconSide":"left" if rng.randrange(2)==0 else "right",
                      "titleIconMode":"none" if rng.random()<.42 else "attached",
                      "iconTreatment":"color-icon" if rng.random()<.46 else "color-block",
                      "componentGap":1 if rng.random()<.62 else 0,
                      "titlePosition":"top",
                      "compositionBias":rng.choice(("balanced","compact","split-left","split-right","edge-frame")),
                      "visualTreatment":rng.choice(("accent-field","neutral-field","accent-outline")),
                      "chartType":"pie" if rng.random()<.5 else "bar",
                      "dark":True if appearance=="dark" else False if appearance=="light" else bool(rng.randrange(2)),
                      "accent":accent,"colorMode":style["mode"],"itemColors":colors,
                      "gradient":MONO_GRADIENTS[accent] if style["mode"]=="mono" else SPECTRUM_GRADIENTS[rng.randrange(len(SPECTRUM_GRADIENTS))]})
    return specs,rng


def presentation_break(value, rng, prefer=False):
    """Optionally add one reproducible editorial line break without changing words."""
    words=normalize(value).split()
    chance=.82 if prefer and len(words)>=10 else .32
    if len(words)<4 or rng.random()>chance: return normalize(value)
    weak_end={"a","an","the","and","or","of","from","in","on","for","by","with","without"}
    def break_cost(cut):
        left,right=" ".join(words[:cut])," ".join(words[cut:])
        orphan=12 if len(words[:cut])==1 or len(words[cut:])==1 else 0
        dangling=18 if words[cut-1].casefold().strip(".,:;!?") in weak_end else 0
        return abs(len(left)-len(right))*.52+orphan+dangling+rng.random()*3
    choices=sorted(range(1,len(words)),key=break_cost)
    cut=choices[0]
    return " ".join(words[:cut])+"\n"+" ".join(words[cut:])


def typography(content):
    if content.get("role")=="cta":
        return {"title":66,"titleMin":40,"subtitle":34,"subtitleMin":23,
                "itemTitle":29,"itemTitleMin":20,"itemText":22,"itemTextMin":17}
    return {"title":52,"titleMin":32,"subtitle":26,"subtitleMin":18,
            "itemTitle":24,"itemTitleMin":18,"itemText":18,"itemTextMin":15}


def block_options(p, content, cols, rows, spec, rng):
    """Measure every semantic block and return all cell rectangles where it fits."""
    pad=p.g/4; item_pad=min(pad,20); type_scale=typography(content)
    blocks=[]
    title=presentation_break(content["title"],rng,False)
    eyebrow=normalize(content.get("eyebrow",""))
    title_options=[]
    uses_visual_mass=not content.get("items") and content.get("role") in ("cover","manifesto","cta")
    widths=list(range(min(cols,3),cols+1)); rng.shuffle(widths)
    for width in widths:
        if uses_visual_mass or spec.get("titleIconMode")=="none": icon_cols=0
        elif width>=10 and rows>=3 and rng.random()<.38: icon_cols=3
        elif width>=7 and rows>=2 and rng.random()<.82: icon_cols=2
        else: icon_cols=1
        text_width=(width-icon_cols)*p.g-2*pad
        if text_width<=p.g: continue
        text_h=p.text_height(title,text_width,type_scale["title"],True)
        label_h=p.g*.52 if eyebrow else 0
        height=max(icon_cols,math.ceil((text_h+label_h+2*pad+(pad*.6 if eyebrow else 0))/p.g))
        if height<=rows:
            title_options.append((width,height,{"text":title,"iconCols":icon_cols}))
            if height+1<=rows: title_options.append((width,height+1,{"text":title,"iconCols":icon_cols}))
    blocks.append({"key":"heading","kind":"title","options":title_options})

    component_description=presentation_break(content.get("body",""),rng,True) if content.get("items") else ""
    if content.get("body") and not component_description:
        value=presentation_break(content["body"],rng,True)
        options=[]
        widths=list(range(min(cols,3),cols+1)); rng.shuffle(widths)
        for width in widths:
            height=required_rows(p,value,width*p.g,type_scale["subtitle"],padding=pad)
            if height<=rows:
                options.append((width,height,{"text":value}))
                if height+1<=rows: options.append((width,height+1,{"text":value}))
        blocks.append({"key":"subtitle","kind":"subtitle","options":options})

    item_metas=[]
    for item in content.get("items",[]):
        if content.get("role")=="list":
            # Lists derive their shared line breaks from the measured common
            # width. Optional editorial breaks would make one row taller and
            # destroy the aligned rhythm of the group.
            item_title=normalize(item["title"])
            item_text=normalize(item.get("text",""))
        else:
            item_title=presentation_break(item["title"],rng,False)
            item_text=presentation_break(item.get("text",""),rng,True)
        item_metas.append({"title":item_title,"text":item_text,"item":item})

    if content.get("role") in ("diagram","chart","timeline","stats","comparison","flow") and item_metas:
        role=content["role"]; options=[]; count=len(item_metas)
        visual_base=max(4,math.ceil(400/p.g))
        for width in range(5,cols+1):
            if role=="chart": height=max(visual_base,math.ceil(count/2)+2)
            elif role in ("diagram","flow"): height=visual_base if count<=3 else visual_base+1
            elif role=="timeline": height=max(visual_base,count)
            elif role=="comparison": height=max(visual_base,3 if count==2 else 4)
            else: height=max(visual_base,math.ceil(count/2)*2)
            description_rows=required_rows(p,component_description,width*p.g,type_scale["subtitle"],padding=pad) if component_description else 0
            if height+description_rows<=rows:
                options.append((width,height+description_rows,{"items":item_metas,"component":role,
                                              "description":component_description,"descriptionRows":description_rows,
                                              "chartType":spec["chartType"] if role=="chart" else None}))
        blocks.append({"key":f"component-{role}","kind":"visual","options":options})
    # Lists of one to nine elements are one aligned semantic group. The page
    # itself remains freely packed; only the internal list rhythm is constrained.
    elif content.get("role") in ("list","cta") and 1<=len(item_metas)<=9:
        count=len(item_metas)
        patterns=[]
        if count==1: patterns.append(("single-1x1",0,"aligned"))
        if count==2: patterns.extend((("aligned-1x2",0,"aligned"),("grid-2x1",1,"grid")))
        if count==3: patterns.append(("aligned-1x3",0,"aligned"))
        if count==4:
            patterns.extend((("grid-2x2",0,"grid"),("aligned-1x4",3,"aligned")))
        if count==5:
            patterns.extend((("aligned-1x5",0,"aligned"),("grid-2x2-left",0,"grid")))
        if count==6: patterns.append(("grid-2x3",0,"grid"))
        if count==7: patterns.append(("grid-2x3-left",0,"grid"))
        if count==8: patterns.append(("grid-2x4",0,"grid"))
        if count==9: patterns.append(("grid-3x3",0,"grid"))
        if count in (2,4,5):
            patterns.extend((("stair-right",5,"stair-right"),("stair-left",5,"stair-left")))
        group_options=[]
        internal_gap=0
        for pattern_name,pattern_penalty,pattern_kind in patterns:
            for tile_width in range(2,cols+1):
                needs=[]
                for meta in item_metas:
                    text_width=(tile_width-1)*p.g-2*item_pad
                    if text_width<=0: needs=[1000]; break
                    title_h=p.text_height(meta["title"],text_width,type_scale["itemTitle"],True)
                    body_h=p.text_height(meta["text"],text_width,type_scale["itemText"]) if meta["text"] else 0
                    needs.append(max(1,math.ceil((title_h+body_h+(p.g/10 if body_h else 0)+2*item_pad)/p.g)))
                tile_height=max(needs)
                if tile_height not in (1,2): continue
                if pattern_kind=="aligned":
                    positions=[(0,i*(tile_height+internal_gap)) for i in range(count)]
                elif pattern_kind=="stair-right":
                    positions=[(i,i*(tile_height+internal_gap)) for i in range(count)]
                elif pattern_kind=="stair-left":
                    positions=[(count-1-i,i*(tile_height+internal_gap)) for i in range(count)]
                else:
                    grid_columns=3 if count==9 else 2
                    positions=[((i%grid_columns)*(tile_width+internal_gap),(i//grid_columns)*(tile_height+internal_gap))
                               for i in range(count)]
                width=max(offset_x+tile_width for offset_x,_ in positions)
                items_height=max(offset_y+tile_height for _,offset_y in positions)
                description_rows=required_rows(p,component_description,width*p.g,type_scale["subtitle"],padding=pad) if component_description else 0
                positions=[(offset_x,offset_y+description_rows) for offset_x,offset_y in positions]
                height=items_height+description_rows
                if width<=cols and height<=rows:
                    group_options.append((width,height,{"items":item_metas,"positions":positions,
                                                        "tileWidth":tile_width,"tileHeight":tile_height,
                                                        "description":component_description,"descriptionRows":description_rows,
                                                        "pattern":pattern_name,"patternPenalty":pattern_penalty}))
        blocks.append({"key":"content-list","kind":"item-group","options":group_options})
    else:
      for index,meta in enumerate(item_metas):
        options=[]
        widths=list(range(min(cols,3),cols+1)); rng.shuffle(widths)
        for width in widths:
            text_width=(width-1)*p.g-2*item_pad
            if text_width<=p.g/2: continue
            title_h=p.text_height(meta["title"],text_width,type_scale["itemTitle"],True)
            body_h=p.text_height(meta["text"],text_width,type_scale["itemText"]) if meta["text"] else 0
            height=max(1,math.ceil((title_h+body_h+(p.g/10 if body_h else 0)+2*item_pad)/p.g))
            if height<=rows:
                options.append((width,height,meta))
                if height+1<=rows: options.append((width,height+1,meta))
        blocks.append({"key":f"item-{index+1}","kind":"item","index":index,"options":options})

    # Pages without repeated items gain a first-class visual mass. It is not a
    # layout template: dimensions and placement are searched on the same grid as
    # text. This can stand for a photograph, a large pixel icon or a color field.
    if not item_metas and content.get("role") in ("cover","manifesto","cta"):
        mass_options=[]
        max_width=max(2,min(cols,math.ceil(cols*.56)))
        for width in range(2,max_width+1):
            for height in range(2,rows+1):
                area=width*height
                if area<6 or area>math.ceil(cols*rows*.48): continue
                ratio=width/height
                if .34<=ratio<=2.2:
                    mass_options.append((width,height,{"component":"visual-mass","treatment":spec["visualTreatment"]}))
        rng.shuffle(mass_options)
        blocks.append({"key":"visual-mass","kind":"visual-mass","options":mass_options})
    if any(not block["options"] for block in blocks):
        raise ValueError("at least one text block does not fit the grid")
    return blocks


def pack_blocks(blocks, cols, rows, module, gap, title_position, rng, composition_bias="balanced"):
    """Randomized backtracking rectangle packer over the real module grid."""
    occupied=set(); placed={}; visits=[0]
    # Semantic order controls reading order, while geometry remains unrestricted.
    order=blocks

    def search(at):
        visits[0]+=1
        if visits[0]>28000: return False
        if at==len(order): return True
        block=order[at]
        options=block["options"][:]
        preferred_ratio={"title":2.5,"subtitle":3.2,"item":2.2,"item-group":1.5,"visual":1.8,"visual-mass":.85}[block["kind"]]
        # Physical readability targets remain stable when the number of grid
        # columns changes; text measurement still makes the final decision.
        minimum_pixels={"title":500,"subtitle":430,"item":430,"item-group":500,"visual":600,"visual-mass":240}[block["kind"]]
        minimum_width=min(cols,math.ceil(minimum_pixels/module))
        target_pixels={"title":190000,"subtitle":115000,"item":82000,"item-group":205000,"visual":310000,"visual-mass":330000}[block["kind"]]
        target_area=target_pixels/(module*module)
        # Favor readable proportions, but keep seeded variation among near-equal fits.
        options.sort(key=lambda option:(abs(option[0]*option[1]-target_area)*.42
                                        +abs(option[0]/option[1]-preferred_ratio)*5
                                        +(28 if option[0]<minimum_width else 0)
                                        +option[2].get("patternPenalty",0)
                                        +rng.random()*5))
        # Keep enough geometries for strict top/bottom composition. Compact
        # multi-column lists can be less ratio-efficient but are sometimes the
        # only valid way to preserve the vertical reading rule.
        for width,height,meta in options[:min(24,len(options))]:
            heading=placed.get("heading")
            positions=[]
            for y in range(rows-height+1):
                for x in range(cols-width+1):
                    if heading and block["kind"]!="title":
                        heading_row=heading[1]; heading_height=heading[3]
                        separation=1 if gap else 0
                        if title_position=="top" and y<heading_row+heading_height+separation: continue
                        if title_position=="bottom" and y+height>heading_row-separation: continue
                    cells={(xx,yy) for yy in range(y,y+height) for xx in range(x,x+width)}
                    if cells & occupied: continue
                    if gap and occupied and any(neighbor in occupied for cell in cells for neighbor in
                                                ((cell[0]-1,cell[1]),(cell[0]+1,cell[1]),(cell[0],cell[1]-1),(cell[0],cell[1]+1))):
                        continue
                    positions.append((x,y))
            anchor_count=min(4,max(1,rows-height+1))
            if title_position=="top":
                anchor_rows=list(range(anchor_count))
            else:
                last=rows-height
                anchor_rows=[last-offset for offset in range(anchor_count)]
            anchor_y=rng.choices(anchor_rows,weights=[3,4,3,2][:len(anchor_rows)],k=1)[0]
            anchor_x=(cols-width)/2+rng.choice((-2,-1,0,0,0,1,2))
            def position_score(pos):
                x,y=pos
                cells={(xx,yy) for yy in range(y,y+height) for xx in range(x,x+width)}
                if block["kind"]=="visual-mass":
                    edge_distance=min(x,cols-(x+width))
                    desired_side=0 if composition_bias=="split-left" else cols-width if composition_bias=="split-right" else None
                    side_cost=abs(x-desired_side)*1.8 if desired_side is not None else edge_distance*.8
                    height_reward=height*.48 if composition_bias.startswith("split-") else height*.22
                    return side_cost-height_reward+abs((y+height/2)-rows/2)*.22+rng.random()*1.3
                if not occupied:
                    return abs(y-anchor_y)*1.15+abs(x-anchor_x)*.48+rng.random()*1.25
                shared=sum((xx-1,yy) in occupied for xx,yy in cells)+sum((xx+1,yy) in occupied for xx,yy in cells)
                shared+=sum((xx,yy-1) in occupied for xx,yy in cells)+sum((xx,yy+1) in occupied for xx,yy in cells)
                all_cells=occupied|cells
                left=min(xx for xx,_ in all_cells); right=max(xx for xx,_ in all_cells)+1
                top=min(yy for _,yy in all_cells); bottom=max(yy for _,yy in all_cells)+1
                bounding=(right-left)*(bottom-top)
                center_cost=abs((left+right)/2-cols/2)*.52+abs((top+bottom)/2-rows*.46)*.28
                aligned=sum(x in (other[0],other[0]+other[2]) or x+width in (other[0],other[0]+other[2])
                            for other in placed.values())
                aligned+=sum(y in (other[1],other[1]+other[3]) or y+height in (other[1],other[1]+other[3])
                             for other in placed.values())
                compact_weight=.075 if composition_bias=="compact" else .045
                edge_bias=-min(x,cols-(x+width),y,rows-(y+height))*.32 if composition_bias=="edge-frame" else 0
                return bounding*compact_weight-shared*(2.2 if not gap else 0)-aligned*.9+center_cost+edge_bias+rng.random()*1.65
            positions.sort(key=position_score)
            for x,y in positions[:min(32,len(positions))]:
                cells={(xx,yy) for yy in range(y,y+height) for xx in range(x,x+width)}
                occupied.update(cells); placed[block["key"]]=(x,y,width,height,meta,block)
                if search(at+1): return True
                occupied.difference_update(cells); placed.pop(block["key"],None)
        return False

    if not search(0): raise ValueError("the measured blocks could not be packed")
    return placed,occupied


def render_item_tile(p, spec, content, key, item_index, meta, box, parent):
    x,y,x2,y2=box; g=p.g; pad=min(g/4,20)
    width=x2-x; height=y2-y
    item=meta["item"]; type_scale=typography(content)
    tile=p.panel(key,box,parent)
    item_color=spec["itemColors"][item_index%len(spec["itemColors"])]
    marker=(x,y,x+g,y+g)
    colored_icon=spec["iconTreatment"]=="color-icon"
    p.panel(key+"-marker",marker,key,fill=p.bg if colored_icon else COLORS[item_color],square=True)
    number_box=(x+g*.12,y+g*.05,x+g*.88,y+g*.23)
    p.text(key+"-digit",str(item_index+1).zfill(2),number_box,key+"-marker",16,11,True,COLORS[item_color] if colored_icon else COLORS["ink"],"center")
    icon_side=g*.72
    icon_box=(x+(g-icon_side)/2,y+g*.27,x+(g+icon_side)/2,y+g*.99)
    p.icon(key+"-icon",item_icon(item,content["iconIntent"]),icon_box,key+"-marker",item_color if colored_icon else "ink")
    tx1=x+g+pad; tx2=x+width-pad; ty1=y+pad; ty2=y+height-pad
    if tx2<=tx1: raise ValueError("Painel de item estreito demais")
    if meta["text"]:
        title_h=p.text_height(meta["title"],tx2-tx1,type_scale["itemTitle"],True)
        split=min(ty2-p.g/5,ty1+title_h+p.g/10)
        p.text(key+"-title",meta["title"],(tx1,ty1,tx2,split),key,type_scale["itemTitle"],type_scale["itemTitleMin"],True,COLORS[item_color])
        p.text(key+"-text",meta["text"],(tx1,split+p.g/20,tx2,ty2),key,type_scale["itemText"],type_scale["itemTextMin"])
    else:
        p.text(key+"-title",meta["title"],(tx1,ty1,tx2,ty2),key,type_scale["itemTitle"],type_scale["itemTitleMin"],True,COLORS[item_color])
    return tile


def render_visual_component(p, spec, content, key, meta, box):
    x1,y1,x2,y2=box; w=x2-x1; h=y2-y1; pad=p.g/4
    items=meta["items"]; role=meta["component"]
    colors=[spec["itemColors"][i%len(spec["itemColors"])] for i in range(len(items))]

    if role=="chart":
        values=[max(1,int(entry["item"].get("value",0) or 1)) for entry in items]
        fills=[COLORS[color] for color in colors]
        if spec["colorMode"]=="mono" and len(items)>1:
            fills=[mix_color(p.accent,COLORS["white"],i*.58/(len(items)-1)) for i in range(len(items))]
        if meta.get("chartType")=="bar":
            baseline=y2-pad-p.g*.72
            top=y1+pad+p.g*.4
            available=max(p.g,baseline-top)
            slot=(w-2*pad)/len(items); bar_width=slot*.52; maximum=max(values)
            p.draw.line((x1+pad,baseline,x2-pad,baseline),fill=p.line,width=3)
            for i,(entry,color,fill,value) in enumerate(zip(items,colors,fills,values)):
                left=x1+pad+i*slot+(slot-bar_width)/2
                bar_top=baseline-available*(value/maximum)
                p.draw.rectangle((round(left),round(bar_top),round(left+bar_width),round(baseline)),fill=fill)
                p.text(f"{key}-value-{i+1}",f"{value}%",(x1+pad+i*slot,y1+pad,x1+pad+(i+1)*slot-4,top-4),key,18,10,True,fill,"center")
                p.text(f"{key}-label-{i+1}",entry["title"],(x1+pad+i*slot,baseline+8,x1+pad+(i+1)*slot-4,y2-pad),key,15,9,True,align="center")
            p.component_rules.append({"component":"bar-chart","items":len(items),"commonBaseline":True,
                                      "equalWidths":True,"regularSpacing":True,"tonalVariation":len(set(fills))==len(fills),"score":1.0})
            return

        ordered=sorted(zip(items,colors,fills,values),key=lambda entry:entry[3],reverse=True)
        side=min(h-2*pad,w*.46)
        pie=(x1+pad,y1+(h-side)/2,x1+pad+side,y1+(h+side)/2)
        p.reserve(key+"-pie",pie,key,"asset")
        total=sum(values); angle=-90
        for entry,color,fill,value in ordered:
            end=angle+360*value/total
            p.draw.pieslice(tuple(round(v) for v in pie),angle,end,fill=fill,outline=p.bg,width=2)
            angle=end
        hole=side*.43; cx=(pie[0]+pie[2])/2; cy=(pie[1]+pie[3])/2
        p.draw.ellipse((cx-hole/2,cy-hole/2,cx+hole/2,cy+hole/2),fill=p.bg,outline=p.line,width=2)
        legend_x=pie[2]+pad; row_h=(h-2*pad)/len(items)
        for i,(entry,color,fill,value) in enumerate(ordered):
            top=y1+pad+i*row_h; marker=max(10,min(18,row_h*.28))
            p.draw.rectangle((legend_x,top+3,legend_x+marker,top+3+marker),fill=fill)
            label=f"{value}%  {entry['title']}"
            p.text(f"{key}-legend-{i+1}",label,(legend_x+marker+10,top,x2-pad,top+row_h-4),key,18,11,True)
        p.component_rules.append({"component":"pie-chart","items":len(items),"largestFirst":True,
                                  "legendAdjacent":True,"circleDominant":side>=min(w,h)*.42,
                                  "tonalVariation":len(set(fills))==len(fills),
                                  "score":1.0 if 2<=len(items)<=5 else .35})
        return

    if role in ("diagram","timeline","flow"):
        horizontal=role in ("diagram","flow") and w/h>1.45
        points=[]
        if horizontal:
            segment=(w-2*pad)/len(items)
            icon_side=min(p.g*.82,segment*.55,h*.32)
            for i in range(len(items)): points.append((x1+pad+segment*(i+.5),y1+pad+icon_side/2))
        else:
            segment=(h-2*pad)/len(items)
            icon_side=min(p.g*.76,segment*.62,w*.18)
            for i in range(len(items)): points.append((x1+pad+icon_side/2,y1+pad+segment*(i+.5)))
        if len(points)>1:
            p.draw.line([tuple(round(v) for v in point) for point in points],fill=p.accent,width=max(3,round(p.g*.045)))
            for start,end in zip(points,points[1:]):
                dx,dy=end[0]-start[0],end[1]-start[1]; length=max(1,math.hypot(dx,dy)); ux,uy=dx/length,dy/length
                tip=(end[0]-ux*icon_side*.58,end[1]-uy*icon_side*.58)
                normal=(-uy,ux); arrow=max(7,p.g*.075)
                back=(tip[0]-ux*arrow*1.6,tip[1]-uy*arrow*1.6)
                p.draw.polygon((tip,(back[0]+normal[0]*arrow,back[1]+normal[1]*arrow),
                                (back[0]-normal[0]*arrow,back[1]-normal[1]*arrow)),fill=p.accent)
        for i,(entry,color,(cx,cy)) in enumerate(zip(items,colors,points)):
            icon_box=(cx-icon_side/2,cy-icon_side/2,cx+icon_side/2,cy+icon_side/2)
            p.draw.rectangle(tuple(round(v) for v in icon_box),fill=p.bg,outline=COLORS[color],width=3)
            p.icon(f"{key}-icon-{i+1}",item_icon(entry["item"],content["iconIntent"]),icon_box,key,color)
            label=entry["title"]+(" — "+entry["text"] if entry["text"] else "")
            if horizontal:
                left=x1+pad+i*segment; text_box=(left,cy+icon_side/2+8,left+segment-6,y2-pad)
                text_valign="top"
            else:
                text_box=(cx+icon_side/2+12,y1+pad+i*segment,x2-pad,y1+pad+(i+1)*segment-4)
                text_valign="center"
            p.text(f"{key}-label-{i+1}",label,text_box,key,17,10,True,COLORS[color] if not entry["text"] else None,
                   valign=text_valign)
        p.component_rules.append({"component":role,"items":len(items),"direction":"horizontal" if horizontal else "vertical",
                                  "equalNodes":True,"regularSpacing":True,"lineCrossings":0,"inwardFlow":True,"score":1.0})
        return

    if role=="comparison":
        count=len(items); cell_w=(w-2*pad)/count
        icon_side=min(p.g*.72,cell_w*.34,h*.22)
        for i,(entry,color) in enumerate(zip(items,colors)):
            left=x1+pad+i*cell_w; right=x1+pad+(i+1)*cell_w-(6 if i<count-1 else 0)
            p.draw.rectangle((round(left),round(y1+pad),round(right),round(y2-pad)),fill=p.bg,outline=COLORS[color],width=3)
            icon_box=(left+(right-left-icon_side)/2,y1+pad*1.35,left+(right-left+icon_side)/2,y1+pad*1.35+icon_side)
            p.icon(f"{key}-icon-{i+1}",item_icon(entry["item"],content["iconIntent"]),icon_box,key,color)
            title_top=icon_box[3]+pad*.45
            p.text(f"{key}-title-{i+1}",entry["title"],(left+12,title_top,right-12,title_top+p.g*.65),key,21,13,True,COLORS[color],"center")
            p.text(f"{key}-text-{i+1}",entry["text"],(left+12,title_top+p.g*.72,right-12,y2-pad*1.3),key,16,10,False,align="center")
        p.component_rules.append({"component":"comparison","items":count,"equalColumns":True,
                                  "sharedAxis":True,"highlightCount":0,"score":1.0 if count in (2,3) else .4})
        return

    # Metric cards: large value plus a concise label, arranged as an even grid.
    cols=2 if len(items)>2 or w/h>1.4 else 1
    rows=math.ceil(len(items)/cols); cell_w=(w-2*pad)/cols; cell_h=(h-2*pad)/rows
    for i,(entry,color) in enumerate(zip(items,colors)):
        col=i%cols; row=i//cols
        left=x1+pad+col*cell_w; top=y1+pad+row*cell_h
        card=(left,top,left+cell_w-6,top+cell_h-6)
        p.draw.rectangle(tuple(round(v) for v in card),fill=p.bg,outline=COLORS[color],width=3)
        value=entry["item"].get("value",0)
        metric=f"{value}%" if value else str(i+1).zfill(2)
        p.text(f"{key}-value-{i+1}",metric,(left+10,top+8,left+cell_w-16,top+cell_h*.48),key,36,22,True,COLORS[color])
        p.text(f"{key}-label-{i+1}",entry["title"],(left+10,top+cell_h*.5,left+cell_w-16,top+cell_h-14),key,17,11,True)
    p.component_rules.append({"component":"stats","items":len(items),"equalCells":True,
                              "rowMajor":True,"singleDominantValue":True,"score":1.0})


def render_component_description(p, key, value, box, pad, type_scale):
    """Paint an attached component band so explanatory copy is never loose on the grid."""
    panel=p.panel("component-description-panel",box,key)
    p.text("component-description",value,inset(panel,pad),"component-description-panel",
           type_scale["subtitle"],type_scale["subtitleMin"])
    return panel


def render_decorative_branches(p, spec, occupied, cols, rows, rng):
    """Grow orthogonal trees, not just lines, without entering content regions."""
    free={(x,y) for y in range(rows) for x in range(cols) if (x,y) not in occupied}
    if len(free)<2: return []
    neighbors=lambda cell: ((cell[0]-1,cell[1]),(cell[0]+1,cell[1]),(cell[0],cell[1]-1),(cell[0],cell[1]+1))
    roots=[cell for cell in free if any(other in occupied for other in neighbors(cell))
           and any(other in free for other in neighbors(cell))]
    if not roots: return []
    maximum_clusters=min(4,len(roots),max(1,len(free)//3))
    # Several nuclei remain possible, but a large tree needs enough of the
    # decoration budget to read as a branch rather than dotted confetti.
    cluster_options=list(range(1,maximum_clusters+1))
    cluster_weights=[2,3,3,2][:maximum_clusters]
    cluster_count=rng.choices(cluster_options,weights=cluster_weights,k=1)[0]
    # A lone nucleus is allowed to become a visible little tree.  More nuclei
    # share the same visual budget so decoration remains secondary to content.
    ranges={1:(10,15),2:(7,12),3:(5,9),4:(4,8)}
    target=sum(rng.randint(*ranges[cluster_count]) for _ in range(cluster_count))
    target=min(target,max(2,round(cols*rows*.17)),len(free))
    chosen_roots=[]
    for _ in range(cluster_count):
        available=[cell for cell in roots if cell in free and cell not in chosen_roots]
        if not available: break
        if chosen_roots:
            root=max(available,key=lambda cell:min(abs(cell[0]-old[0])+abs(cell[1]-old[1]) for old in chosen_roots)+rng.random()*3)
        else: root=available[rng.randrange(len(available))]
        chosen_roots.append(root)

    # Keep each selected origin available for its own tree. Without this guard,
    # the first tree can swallow a neighbouring nucleus before it starts.
    reserved_roots=set(chosen_roots)
    records=[]; remaining=target
    for cluster,root in enumerate(chosen_roots):
        clusters_left=len(chosen_roots)-cluster
        desired=max(2,remaining//clusters_left)
        branch=[root]; degrees={root:0}; parents={root:None}
        free.remove(root)
        # Preserve at least one growth corridor around every nucleus that has
        # not started yet. Earlier trees therefore cannot strand a later root.
        future_protected={cell for future in chosen_roots[cluster+1:] for cell in neighbors(future) if cell in free}
        gradient=rng.random()<.5
        keep_color=spec.get("colorMode")=="mono" or rng.random()<.55
        branch_color=spec["accent"] if keep_color else ACCENTS[rng.randrange(len(ACCENTS))]
        while len(branch)<desired:
            options_by_parent={cell:[other for other in neighbors(cell) if other in free and other not in reserved_roots
                                     and other not in future_protected]
                               for cell in branch}
            options_by_parent={cell:options for cell,options in options_by_parent.items() if options}
            if not options_by_parent: break
            # During the first half of a larger cluster, repeatedly return to
            # cells with two or more exits. This makes forks and T/Y shapes
            # likely, while the fallback still permits an organic long arm.
            forkable=[cell for cell,options in options_by_parent.items()
                      if len(options)>=2 and degrees[cell]<3]
            if forkable and len(branch)<max(3,desired-1) and rng.random()<.78:
                parent=max(forkable,key=lambda cell:len(options_by_parent[cell])*3-degrees[cell]+rng.random())
            else:
                parents_with_options=list(options_by_parent)
                weights=[(len(options_by_parent[cell])+1)**2/(1+degrees[cell]*1.5) for cell in parents_with_options]
                parent=rng.choices(parents_with_options,weights=weights,k=1)[0]
            children=options_by_parent[parent]
            child_weights=[]
            for child in children:
                future=sum(other in free for other in neighbors(child))
                child_weights.append(1+future*1.8+rng.random())
            child=rng.choices(children,weights=child_weights,k=1)[0]
            free.remove(child); branch.append(child); parents[child]=parent
            degrees[parent]+=1; degrees[child]=1
        remaining-=len(branch)
        gradient_bounds=None
        gradient_image=None
        if gradient:
            min_x=min(cell[0] for cell in branch); max_x=max(cell[0] for cell in branch)+1
            min_y=min(cell[1] for cell in branch); max_y=max(cell[1] for cell in branch)+1
            gradient_bounds={"column":min_x,"row":min_y,"columns":max_x-min_x,"rows":max_y-min_y}
            with Image.open(p.design/f"assets/gradients/{spec['gradient']}.png") as source:
                gradient_image=source.convert("RGB").resize(((max_x-min_x)*p.g,(max_y-min_y)*p.g),Image.Resampling.LANCZOS)
        for step,(cell_x,cell_y) in enumerate(branch):
            name=f"decor-branch-{cluster+1}-{step+1}"
            box=(cell_x*p.g,p.g+cell_y*p.g,(cell_x+1)*p.g,p.g+(cell_y+1)*p.g)
            if gradient:
                box=p.reserve(name,box,"content","asset")
                p.squares.append(box)
                crop_x=(cell_x-gradient_bounds["column"])*p.g
                crop_y=(cell_y-gradient_bounds["row"])*p.g
                patch=gradient_image.crop((crop_x,crop_y,crop_x+p.g,crop_y+p.g))
                p.image.paste(patch,(box[0],box[1]))
                color=spec["gradient"]
            else:
                color=branch_color if keep_color or step==0 else ACCENTS[rng.randrange(len(ACCENTS))]
                p.panel(name,box,"content",fill=COLORS[color],square=True,bordered=False)
            parent=parents[(cell_x,cell_y)]
            records.append({"name":name,"cluster":cluster+1,"step":step+1,"column":cell_x,"row":cell_y,
                            "parent":None if parent is None else {"column":parent[0],"row":parent[1]},
                            "type":"gradient" if gradient else "solid","color":color,
                            "gradientBounds":gradient_bounds})
    return records


def decode_profile_photo(value):
    if not value: return None
    try:
        header,encoded=value.split(",",1)
        if header not in ("data:image/jpeg;base64","data:image/png;base64"):
            raise ValueError
        with Image.open(io.BytesIO(base64.b64decode(encoded,validate=True))) as source:
            if source.size!=(1080,1080): raise ValueError
            return source.convert("RGB")
    except Exception as error:
        raise ValueError("Invalid footer photo; crop it again at 1080x1080") from error


def render_candidate(content,index,total,size,design,spec,about=None,profile_photo=None):
    p=Page(*size,spec["dark"],design,index+1,spec["accent"])
    p.color_mode=spec["colorMode"]
    p.item_colors=spec["itemColors"]
    w,h,g=p.w,p.h,p.g; type_scale=typography(content)
    pad=g/4
    header=p.panel("header",(0,0,w,g))
    brand_width=min(4*g,w*.48)
    p.asset("brand",f"assets/brand/lockup-{'dark' if p.dark else 'light'}.png",(pad,g*.2,brand_width-pad,g*.8),"header")

    footer_y=(h//g-1)*g
    if footer_y<=g: raise ValueError("Format does not have enough rows")
    footer=p.panel("footer",(0,footer_y,w,h))
    about=about or {}
    use_about=bool(about.get("enabled"))
    footer_height=h-footer_y
    footer_pad=max(10,round(min(g,footer_height)*.12))
    logo_variant="dark" if p.dark else "light"
    logo_width=min(round(g*.82),110)
    counter_width=min(round(g*1.35),170)
    counter_top=footer_y+round((footer_height-22)/2)
    counter_bottom=min(h-footer_pad,counter_top+30)
    if use_about:
        counter_left=round((w-counter_width)/2)
        counter_box=(counter_left,counter_top,counter_left+counter_width,counter_bottom)
        logo_box=(w-footer_pad-logo_width,footer_y+footer_pad,w-footer_pad,h-footer_pad)
        p.asset("footer-aws-logo",f"assets/brand/aws-mark-{logo_variant}.png",logo_box,"footer")
        p.text("page-number",f"{index+1:02d} / {total:02d}",counter_box,"footer",18,13,True,align="center")
        cursor=footer_pad
        if profile_photo is not None:
            photo_side=min(round(g*.78),footer_height-2*footer_pad)
            photo_box=p.reserve("footer-photo",(cursor,footer_y+footer_pad,cursor+photo_side,footer_y+footer_pad+photo_side),"footer","asset")
            p.squares.append(photo_box)
            photo=profile_photo.resize((photo_side,photo_side),Image.Resampling.LANCZOS)
            p.image.paste(photo,(photo_box[0],photo_box[1]))
            cursor=photo_box[2]+footer_pad
        text_right=counter_box[0]-footer_pad
        name=normalize(about.get("name",""))
        subtitle=normalize(about.get("subtitle",""))
        if name:
            name_bottom=footer_y+footer_height*.52 if subtitle else h-footer_pad
            p.text("footer-about-name",name,(cursor,footer_y+footer_pad,text_right,name_bottom),"footer",20,14,True,p.accent)
        if subtitle:
            subtitle_top=footer_y+footer_height*.54 if name else footer_y+footer_pad
            p.text("footer-about-subtitle",subtitle,(cursor,subtitle_top,text_right,h-footer_pad),"footer",14,11)
    else:
        logo_box=(footer_pad,footer_y+footer_pad,footer_pad+logo_width,h-footer_pad)
        p.asset("footer-aws-logo",f"assets/brand/aws-mark-{logo_variant}.png",logo_box,"footer")
        counter_box=(w-footer_pad-counter_width,counter_top,w-footer_pad,counter_bottom)
        p.text("page-number",f"{index+1:02d} / {total:02d}",counter_box,"footer",18,13,True,align="right")

    bottom=footer_y
    if content["cta"]:
        bottom-=g
        cta=p.panel("cta",(0,bottom,w,bottom+g),fill=p.accent)
        p.text("cta-text",content["cta"],inset(cta,pad),"cta",26,18,True,COLORS["ink"],"center")
    p.reserve("content",(0,g,w,bottom))
    total_rows=(bottom-g)//g; total_cols=w//g
    rng=random.Random(spec["attemptSeed"])
    blocks=block_options(p,content,total_cols,total_rows,spec,rng)
    try:
        placements,occupied=pack_blocks(blocks,total_cols,total_rows,g,spec["componentGap"],spec["titlePosition"],rng,spec["compositionBias"])
    except ValueError:
        if not spec["componentGap"]:
            raise
        # A gap is a visual preference. When the measured blocks fit only edge
        # to edge, keep the content and relax that preference instead of
        # forcing a new editorial draft.
        spec["componentGap"]=0
        placements,occupied=pack_blocks(blocks,total_cols,total_rows,g,0,spec["titlePosition"],rng,spec["compositionBias"])
    p.block_allocations=[]
    p.component_rules=[]
    p.component_gap=spec["componentGap"]
    p.title_position=spec["titlePosition"]
    p.composition_bias=spec["compositionBias"]
    p.title_icon_mode="attached" if placements["heading"][4]["iconCols"] else "none"

    for key,(cell_x,cell_y,cell_w,cell_h,meta,block) in sorted(placements.items(),key=lambda pair:(pair[1][1],pair[1][0])):
        x=cell_x*g; y=g+cell_y*g; width=cell_w*g; height=cell_h*g
        raw_box=(x,y,x+width,y+height)
        if block["kind"]=="item-group": box=p.reserve(key,raw_box,"content")
        elif block["kind"]=="item": box=raw_box
        elif block["kind"]=="visual-mass":
            fill=p.accent if meta["treatment"]=="accent-field" else p.bg
            box=p.panel(key,raw_box,"content",fill=fill)
        else: box=p.panel(key,raw_box,"content")
        p.block_allocations.append({"name":key,"type":block["kind"],"column":cell_x,"row":cell_y,"columns":cell_w,"rows":cell_h})
        if block["kind"]=="title":
            icon_cols=meta["iconCols"]; icon_size=icon_cols*g
            if not icon_cols:
                icon_box=None; tx1=x+pad; tx2=x+width-pad
            elif spec["iconSide"]=="left":
                icon_box=(x,y,x+icon_size,y+icon_size); tx1=x+icon_size+pad; tx2=x+width-pad
            else:
                icon_box=(x+width-icon_size,y,x+width,y+icon_size); tx1=x+pad; tx2=x+width-icon_size-pad
            if icon_box:
                colored_icon=spec["iconTreatment"]=="color-icon"
                p.panel("primary-icon-cell",icon_box,key,fill=p.bg if colored_icon else p.accent,square=True)
                p.icon("page-icon",content["iconIntent"],icon_box,"primary-icon-cell",p.accent_name if colored_icon else "ink")
            title_top=y+pad
            if content.get("eyebrow"):
                label_width=min(tx2-tx1,max(2*g,min(4*g,len(content["eyebrow"])*g*.13+g)))
                label_box=(tx1,title_top,tx1+label_width,title_top+g*.42)
                p.label("eyebrow-label",content["eyebrow"],label_box,key,p.accent)
                title_top=label_box[3]+pad*.6
            p.text("title",meta["text"],(tx1,title_top,tx2,y+height-pad),key,type_scale["title"],type_scale["titleMin"],True)
        elif block["kind"]=="subtitle":
            p.text("subtitle-text",meta["text"],inset(box,pad),key,type_scale["subtitle"],type_scale["subtitleMin"])
        elif block["kind"]=="visual":
            description_rows=meta.get("descriptionRows",0)
            if description_rows:
                description_box=(x,y,x+width,y+description_rows*g)
                render_component_description(p,key,meta["description"],description_box,pad,type_scale)
            visual_box=(x,y+description_rows*g,x+width,y+height)
            render_visual_component(p,spec,content,key,meta,visual_box)
            if p.component_rules:
                p.component_rules[-1]["descriptionAttached"]=bool(description_rows)
        elif block["kind"]=="visual-mass":
            side=min(width,height)*(.72 if meta["treatment"]!="accent-outline" else .86)
            icon_box=(x+(width-side)/2,y+(height-side)/2,x+(width+side)/2,y+(height+side)/2)
            variant="ink" if meta["treatment"]=="accent-field" else p.accent_name
            p.icon("visual-mass-icon",content["iconIntent"],icon_box,key,variant)
        elif block["kind"]=="item-group":
            description_rows=meta.get("descriptionRows",0)
            if description_rows:
                description_box=(x,y,x+width,y+description_rows*g)
                render_component_description(p,key,meta["description"],description_box,pad,type_scale)
            tile_w=meta["tileWidth"]*g; tile_h=meta["tileHeight"]*g
            for item_index,(item_meta,(offset_x,offset_y)) in enumerate(zip(meta["items"],meta["positions"])):
                item_key=f"item-{item_index+1}"
                item_box=(x+offset_x*g,y+offset_y*g,x+offset_x*g+tile_w,y+offset_y*g+tile_h)
                render_item_tile(p,spec,content,item_key,item_index,item_meta,item_box,key)
                p.block_allocations.append({"name":item_key,"type":"item","column":cell_x+offset_x,
                                            "row":cell_y+offset_y,"columns":meta["tileWidth"],
                                            "rows":meta["tileHeight"],"listPattern":meta["pattern"]})
            p.component_rules.append({"component":"list","items":len(meta["items"]),"pattern":meta["pattern"],
                                      "equalItems":True,"rowMajor":not meta["pattern"].startswith("stair"),
                                      "orphanAlignedLeft":len(meta["items"])%2==0 or meta["positions"][-1][0]==0,
                                      "descriptionAttached":bool(description_rows),
                                      "score":max(.35,1-meta.get("patternPenalty",0)*.11)})
        else:
            item_index=block["index"]; item=meta["item"]
            # Non-list roles remain independently packable.
            render_item_tile(p,spec,content,key,item_index,meta,raw_box,"content")

    p.decorative_branches=render_decorative_branches(p,spec,occupied,total_cols,total_rows,rng)
    return p


def _layout_blocks(page):
    return [block for block in page.block_allocations
            if block["type"] in ("title","subtitle","visual","visual-mass","item-group")
            or (block["type"]=="item" and "listPattern" not in block)]


def _cells(block):
    return {(x,y) for y in range(block["row"],block["row"]+block["rows"])
            for x in range(block["column"],block["column"]+block["columns"])}


def _shared_edge(a,b):
    acells,bcells=_cells(a),_cells(b)
    return sum((x+1,y) in bcells for x,y in acells)+sum((x,y+1) in bcells for x,y in acells)+sum((x-1,y) in bcells for x,y in acells)+sum((x,y-1) in bcells for x,y in acells)


def _largest_empty_region(cols,rows,occupied):
    remaining={(x,y) for y in range(rows) for x in range(cols)}-occupied
    largest=0; components=0
    while remaining:
        components+=1; stack=[remaining.pop()]; size=0
        while stack:
            x,y=stack.pop(); size+=1
            for neighbor in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if neighbor in remaining:
                    remaining.remove(neighbor); stack.append(neighbor)
        largest=max(largest,size)
    return largest,components


def layout_score(page):
    """Score editorial relationships, not only rectangle occupancy."""
    blocks=_layout_blocks(page)
    if not blocks: return 0.0
    content_box=page.regions["content"]["box"]
    cols=round((content_box[2]-content_box[0])/page.g); rows=round((content_box[3]-content_box[1])/page.g)
    areas=[block["columns"]*block["rows"] for block in blocks]; total_area=sum(areas)
    weights={"title":1.55,"subtitle":1.0,"item":1.0,"item-group":1.25,"visual":1.45,"visual-mass":1.9}
    weighted=sum(area*weights[block["type"]] for block,area in zip(blocks,areas))
    cx=sum((block["column"]+block["columns"]/2)*area*weights[block["type"]] for block,area in zip(blocks,areas))/weighted/cols
    cy=sum((block["row"]+block["rows"]/2)*area*weights[block["type"]] for block,area in zip(blocks,areas))/weighted/rows
    left=min(block["column"] for block in blocks); right=max(block["column"]+block["columns"] for block in blocks)
    top=min(block["row"] for block in blocks); bottom=max(block["row"]+block["rows"] for block in blocks)
    span_x=(right-left)/cols; span_y=(bottom-top)/rows

    pairs=max(1,len(blocks)*(len(blocks)-1)//2); alignments=0; adjacency=0
    for index,a in enumerate(blocks):
        ax=(a["column"],a["column"]+a["columns"],a["column"]+a["columns"]/2)
        ay=(a["row"],a["row"]+a["rows"],a["row"]+a["rows"]/2)
        for b in blocks[index+1:]:
            bx=(b["column"],b["column"]+b["columns"],b["column"]+b["columns"]/2)
            by=(b["row"],b["row"]+b["rows"],b["row"]+b["rows"]/2)
            alignments+=min(2,sum(abs(one-two)<.01 for one in ax for two in bx)+sum(abs(one-two)<.01 for one in ay for two in by))
            adjacency+=min(2,_shared_edge(a,b))
    alignment_score=min(1,alignments/(pairs*1.35))
    adjacency_score=min(1,adjacency/max(2,len(blocks)*1.4))

    occupied=set().union(*(_cells(block) for block in blocks))
    largest_empty,empty_components=_largest_empty_region(cols,rows,occupied)
    empty_ratio=largest_empty/(cols*rows)
    negative_space=max(0,1-abs(empty_ratio-.34)/.34)*max(.55,1-(empty_components-1)*.055)
    bounding=max(1,(right-left)*(bottom-top)); grouping=total_area/bounding

    heading=next((block for block in blocks if block["type"]=="title"),None)
    title_ratio=(heading["columns"]*heading["rows"])/max(1,total_area) if heading else 0
    geometric_hierarchy=min(1,(title_ratio/.34)*.62+(heading["columns"]/cols if heading else 0)*.38)
    title_text=next((text for text in page.texts if text["name"]=="title"),None)
    support_texts=[text for text in page.texts if text["name"] not in ("title","page-number")
                   and not text["name"].startswith("footer-") and not text["name"].endswith("-digit")]
    largest_support=max((text["size"] for text in support_texts),default=max(1,title_text["size"]*.45 if title_text else 1))
    contrast=max(0,min(1,(title_text["size"]/largest_support-1)/1.05)) if title_text else 0
    text_sizes=sorted((text["size"] for text in [title_text,*support_texts] if text),reverse=True)
    bands=[]
    for size in text_sizes:
        if not bands or size<bands[-1]*.78: bands.append(size)
    level_score=1 if len(bands)<=3 else max(.35,1-(len(bands)-3)*.2)
    hierarchy=geometric_hierarchy*.58+contrast*.27+level_score*.15
    title_words=len(title_text["text"].split()) if title_text else 100
    title_economy=max(.35,1-max(0,title_words-8)*.09)

    masses=sorted((area*weights[block["type"]] for block,area in zip(blocks,areas)),reverse=True)
    dominance=1 if len(masses)==1 else min(1,max(0,masses[0]/max(.01,masses[1])-1)/.55)
    edge_contacts=sum((left==0,right==cols,top==0,bottom==rows))
    edge_score=max(0,1-abs(edge_contacts-1.5)/2.5)
    balance=max(0,1-abs(cx-.5)*2.25-abs(cy-.48)*1.35)

    textual=[block for block in blocks if block["type"]!="visual-mass"]
    if page.title_position=="top":
        vertical_valid=all(block is heading or block["row"]>=heading["row"]+heading["rows"]+page.component_gap for block in textual)
        reading_order=sorted(textual,key=lambda block:(block["row"],block["column"]))
    else:
        vertical_valid=all(block is heading or block["row"]+block["rows"]<=heading["row"]-page.component_gap for block in textual)
        reading_order=sorted(textual,key=lambda block:(-block["row"],block["column"]))
    centers=[block["column"]+block["columns"]/2 for block in reading_order]
    direction_changes=sum((b-a)*(c-b)<0 for a,b,c in zip(centers,centers[1:],centers[2:]))
    reading_flow=(.72 if vertical_valid else 0)+.28*max(0,1-direction_changes/max(1,len(centers)-2))

    gaps=[]
    for index,a in enumerate(blocks):
        nearest=[]
        for b in blocks[:index]+blocks[index+1:]:
            dx=max(0,max(a["column"],b["column"])-min(a["column"]+a["columns"],b["column"]+b["columns"]))
            dy=max(0,max(a["row"],b["row"])-min(a["row"]+a["rows"],b["row"]+b["rows"]))
            nearest.append(dx+dy)
        if nearest: gaps.append(min(nearest))
    proximity=1/(1+(sum(gaps)/max(1,len(gaps)))*.5)
    vertical_axes={value for block in blocks for value in (block["column"],block["column"]+block["columns"])}
    axis_budget=min(cols+1,max(3,len(blocks)+1))
    grid_discipline=max(.35,1-max(0,len(vertical_axes)-axis_budget)/max(1,cols+1-axis_budget))

    list_blocks=[block for block in page.block_allocations if block.get("listPattern")]
    list_score=1.0
    if list_blocks:
        widths={block["columns"] for block in list_blocks}; heights={block["rows"] for block in list_blocks}
        patterns={block["listPattern"] for block in list_blocks}
        list_score=(1 if len(widths)==len(heights)==len(patterns)==1 else 0)+min(1,max(widths)/cols)
        list_score/=2

    component_score=sum(rule.get("score",0) for rule in page.component_rules)/len(page.component_rules) if page.component_rules else 1

    branches=page.decorative_branches
    clusters={entry["cluster"] for entry in branches}
    decor_ratio=len(branches)/(cols*rows)
    decor_score=max(0,1-abs(decor_ratio-.15)/.15)
    if not (1<=len(clusters)<=4): decor_score*=.5
    color_score=1 if page.color_mode=="mono" and len(set(page.item_colors))==1 else min(1,len(set(page.item_colors))/4)

    target_x=.88 if page.composition_bias.startswith("split-") or any(block["type"]=="visual-mass" for block in blocks) else min(.82,.48+.055*len(blocks))
    target_y=min(.88,.46+.065*len(blocks))
    coverage_score=max(0,1-abs(span_x-target_x)*1.35-abs(span_y-target_y)*1.1)
    breakdown={"readingFlow":reading_flow,"dominance":dominance,"hierarchy":hierarchy,"titleEconomy":title_economy,"contrast":contrast,
               "balance":balance,"coverage":coverage_score,"alignment":alignment_score,
               "adjacency":adjacency_score,"grouping":grouping,"negativeSpace":negative_space,
               "proximity":proximity,"gridDiscipline":grid_discipline,"edgeUse":edge_score,
               "listRhythm":list_score,"componentRules":component_score,
               "decoration":decor_score,"colorRhythm":color_score}
    score_weights={"readingFlow":12,"dominance":8,"hierarchy":10,"titleEconomy":4,"contrast":6,"balance":6,
                   "coverage":7,"alignment":12,"adjacency":5,"grouping":5,"negativeSpace":10,
                   "proximity":7,"gridDiscipline":6,"edgeUse":4,"listRhythm":5,
                   "componentRules":10,"decoration":3,"colorRhythm":4}
    score=100*sum(breakdown[key]*weight for key,weight in score_weights.items())/sum(score_weights.values())
    page.layout_score_breakdown={key:round(value,3) for key,value in breakdown.items()}
    return round(score,3)


def layout_distance(first,second):
    """Return 0..1 visual distance so shifted copies do not fake variety."""
    a={block["name"]:block for block in _layout_blocks(first)}
    b={block["name"]:block for block in _layout_blocks(second)}
    keys=set(a)|set(b); geometry=0
    for key in keys:
        if key not in a or key not in b:
            geometry+=1; continue
        one,two=a[key],b[key]
        delta=(abs(one["column"]-two["column"])/max(1,first.w/first.g)+
               abs(one["row"]-two["row"])/max(1,first.h/first.g)+
               abs(one["columns"]-two["columns"])/max(1,first.w/first.g)+
               abs(one["rows"]-two["rows"])/max(1,first.h/first.g))/2
        geometry+=min(1,delta)
    geometry/=max(1,len(keys))
    branch_a={(entry["column"],entry["row"]) for entry in first.decorative_branches}
    branch_b={(entry["column"],entry["row"]) for entry in second.decorative_branches}
    decor=1-len(branch_a&branch_b)/max(1,len(branch_a|branch_b))
    first_components=tuple(rule.get("component") for rule in first.component_rules)
    second_components=tuple(rule.get("component") for rule in second.component_rules)
    categorical=sum((first.title_position!=second.title_position,
                     first.title_icon_mode!=second.title_icon_mode,
                     first.composition_bias!=second.composition_bias,
                     first_components!=second_components))/4
    return min(1,geometry*.62+decor*.23+categorical*.15)


def _visual_signature(page):
    data={"blocks":page.block_allocations,"branches":[(entry["column"],entry["row"],entry["type"]) for entry in page.decorative_branches],
          "titleIcon":page.title_icon_mode,"bias":page.composition_bias,
          "components":[rule.get("component") for rule in page.component_rules]}
    return json.dumps(data,sort_keys=True,separators=(",",":"))


def render_page(content,index,total,size,design,seed=0,style=None,about=None,profile_photo=None,appearance="both"):
    selection_seed=stable_seed(content,index,seed)
    style=style or campaign_style(seed or selection_seed)
    specs,rng=candidate_specs(content,size,selection_seed,style,appearance)
    candidates=[]
    failures=[]
    for spec in specs:
        try:
            page=render_candidate(content,index,total,size,design,spec,about,profile_photo)
            page.layout_score=layout_score(page)
            signature=_visual_signature(page)
            layout="pack-"+hashlib.sha256(signature.encode()).hexdigest()[:10]
            if layout in [name for name,_ in candidates]: continue
            candidates.append((layout,page))
            if len(candidates)==12: break
        except ValueError as error:
            failures.append(str(error))
    if len(candidates)<3:
        raise ValueError(f"Page {index+1}: could not form three valid layouts ({'; '.join(failures[:3])})")
    candidates.sort(key=lambda candidate:candidate[1].layout_score,reverse=True)
    best=candidates[0][1].layout_score
    viable=[candidate for candidate in candidates if candidate[1].layout_score>=best-14]
    diverse=[viable[0]]
    while len(diverse)<3:
        pool=[candidate for candidate in viable if candidate not in diverse]
        if not pool: pool=[candidate for candidate in candidates if candidate not in diverse]
        if not pool: break
        candidate=max(pool,key=lambda value:value[1].layout_score+18*min(layout_distance(value[1],old[1]) for old in diverse))
        diverse.append(candidate)
    if len(diverse)<3:
        raise ValueError(f"Page {index+1}: candidates are not diverse enough")
    candidates=diverse
    selection_rng=random.Random(selection_seed ^ 0x5A17D1A5)
    weights=[math.exp((candidate.layout_score-best)/6.5) for _,candidate in candidates]
    selected=selection_rng.choices(range(3),weights=weights,k=1)[0]
    names=[name for name,_ in candidates]
    scores=[{"layout":name,"score":candidate.layout_score,
             "distanceFromBest":round(layout_distance(candidate,candidates[0][1]),3)} for name,candidate in candidates]
    page=candidates[selected][1]
    page.selected_layout=names[selected]
    page.candidate_layouts=names
    page.candidate_scores=scores
    page.selection_seed=selection_seed
    return page


def render_campaign(draft, output, design):
    size=FORMATS[draft["brief"]["platform"]]
    if draft["version"] != 1 or len(draft["pages"]) != draft["brief"]["postCount"]:
        raise ValueError("Invalid page count or version")
    output=Path(output)
    seed=int(draft.get("layoutSeed",0))
    if seed==0:
        seed=int.from_bytes(hashlib.sha256(json.dumps(draft,sort_keys=True,ensure_ascii=False).encode()).digest()[:8],"big")
    brief=draft.get("brief",{})
    style=campaign_style(seed,brief.get("colorTheme"))
    requested_appearance=brief.get("pageTheme","both")
    if requested_appearance not in ("dark","light","both"):
        raise ValueError("Invalid page appearance")
    if requested_appearance=="both":
        first="dark" if random.Random(seed ^ 0xA991).randrange(2)==0 else "light"
        appearances=[first if i%2==0 else ("light" if first=="dark" else "dark") for i in range(len(draft["pages"]))]
    else:
        appearances=[requested_appearance]*len(draft["pages"])
    about={"enabled":brief.get("useAboutFooter",False),"name":brief.get("aboutName",""),"subtitle":brief.get("aboutSubtitle","")}
    profile_photo=decode_profile_photo(brief.get("aboutPhoto",""))
    pages=[render_page(page,i,len(draft["pages"]),size,Path(design),seed,style,about,profile_photo,appearances[i]) for i,page in enumerate(draft["pages"])]
    # Validate the whole campaign before publishing any asset.
    output.mkdir(parents=True,exist_ok=True)
    files=[]
    for i,page in enumerate(pages):
        name=f"page-{i+1:02d}.png"
        page.image.save(output/name)
        with Image.open(output/name) as check:
            check.load()
            if check.size!=size: raise ValueError("Invalid PNG dimensions")
        files.append({"name":name,"kind":"page","width":size[0],"height":size[1]})
    images=[p.image for p in pages]
    images[0].save(output/"campaign.pdf","PDF",resolution=150,save_all=True,append_images=images[1:])
    pdf=(output/"campaign.pdf").read_bytes()
    if len(re.findall(rb"/Type\s*/Page\b",pdf))!=len(pages): raise ValueError("PDF is missing pages")
    files.append({"name":"campaign.pdf","kind":"document"})
    thumb_w=270
    thumb_h=round(size[1]*thumb_w/size[0])
    cols=min(3,len(pages)); rows=math.ceil(len(pages)/cols); gap=16
    preview=Image.new("RGB",(cols*(thumb_w+gap)+gap,rows*(thumb_h+gap)+gap),"#30343A")
    for i,page in enumerate(pages):
        preview.paste(page.image.resize((thumb_w,thumb_h),Image.Resampling.LANCZOS),(gap+(i%cols)*(thumb_w+gap),gap+(i//cols)*(thumb_h+gap)))
    preview.save(output/"preview.png")
    files.append({"name":"preview.png","kind":"preview","width":preview.width,"height":preview.height})
    report={"rendererVersion":VERSION,"layoutSeed":seed,"colorSystem":style,"pageTheme":requested_appearance,
            "pages":[p.report(c["role"]) for p,c in zip(pages,draft["pages"])],"files":files}
    (output/"validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    (output/"campaign.json").write_text(json.dumps(draft,ensure_ascii=False,indent=2),encoding="utf-8")
    for f in files: print(output/f["name"])
    return report


if __name__ == "__main__":
    if "CAMPAIGN_B64" in globals():
        draft=json.loads(base64.b64decode(CAMPAIGN_B64))
        destination=Path(__file__).resolve().parent/"output"
    else:
        draft=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
        destination=Path(sys.argv[2])
    render_campaign(draft,destination,os.environ.get("AWS_DESIGN_SYSTEM_DIR","design_system"))
