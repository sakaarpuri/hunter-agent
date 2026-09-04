"""HunterAgent editorial film. Timing is shared with the homepage and score."""
from pathlib import Path
import json, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps

PAPER = (245, 243, 236)
INK = (32, 33, 31)
ORANGE = (198, 75, 44)
WHITE = (255, 252, 244)
ROOT = Path(__file__).parent
TIMING = json.loads((ROOT / "timing.json").read_text())
FPS = TIMING["fps"]
SECONDS = TIMING["durationSeconds"]
TRANSITION = TIMING["transitionSeconds"]
FONT = str(ROOT / "SpaceGrotesk.ttf")
MONO = next((str(path) for path in [
    ROOT / "DejaVuSansMono.ttf",
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    Path("/System/Library/Fonts/SFNSMono.ttf"),
] if path.exists()), FONT)
STORY = json.loads((ROOT / "story.json").read_text())
TITLES = [scene["lines"] for scene in STORY[:4]]
LABELS = [scene["label"] for scene in STORY[:4]]
fonts = {}
def font(size, mono=False):
    key = (round(size), mono)
    if key not in fonts:
        f = ImageFont.truetype(MONO if mono else FONT, max(8, round(size)))
        if not mono:
            try: f.set_variation_by_name("Medium")
            except Exception: pass
        fonts[key] = f
    return fonts[key]
def ease(x): return 1 - (1 - min(1, max(0, x))) ** 3
def fit(im, size, center=(0.5, 0.5)):
    return ImageOps.fit(im, tuple(map(int, size)), method=Image.Resampling.LANCZOS, centering=center)
def text(draw, xy, value, size, color=INK, mono=False, anchor=None):
    draw.text(xy, value, font=font(size, mono), fill=color, anchor=anchor, stroke_width=0)
def bars(draw, x, y, size, color=ORANGE, phase=1):
    for j in range(5):
        h = size * ease(phase - j * .08)
        xx = x + j * size * .38
        draw.polygon([(xx, y+size), (xx+size*.19,y+size-h), (xx+size*.36,y+size-h), (xx+size*.17,y+size)], fill=color)
def line_reveal(im, lines, x, y, size, color, local, reflection=False):
    for j, line in enumerate(lines):
        progress = ease(local / .3) if reflection else ease((local - .08 - j * .08) / .4)
        layer = Image.new("RGBA", im.size)
        d = ImageDraw.Draw(layer)
        d.text((x,y+j*size*1.04+(1-progress)*size*.75),line,font=font(size),fill=(*color,round(255*progress)))
        im.paste(layer,(0,0),layer)
def graphic(draw, w, h, t, kind, color, scale):
    cx, cy = w*.77, h*.36
    for ring in range(4):
        r = (30 + ring*32) * scale
        draw.arc((cx-r,cy-r,cx+r,cy+r),start=20+ring*18,end=20+ring*18+min(320, max(0,t*240-ring*25)),fill=color,width=max(1,round(scale*2)))
    if kind == 3:
        for j in range(6):
            x = w*.6+j*w*.05
            height = h*(.08+.025*(j%3))*ease(t-j*.05)
            draw.line((x,h*.82,x,h*.82-height),fill=color,width=max(1,round(scale*2)))
def render(portrait=False):
    w,h = (1080,1920) if portrait else (1920,1080)
    s=w/1280 if not portrait else w/720
    margin=round(w*.07)
    target=ROOT/("portrait.mp4" if portrait else "landscape.mp4")
    raw=ROOT/("portrait-raw.mp4" if portrait else "landscape-raw.mp4")
    encoder=subprocess.Popen(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-vcodec","rawvideo","-pix_fmt","rgb24","-s",f"{w}x{h}","-r",str(FPS),"-i","-","-an","-c:v","libx264","-preset","fast","-crf","20","-pix_fmt","yuv420p",str(raw)],stdin=subprocess.PIPE)
    readers={}
    snapshots=[]
    previous=None
    departing=None
    last_scene=-1
    snapshot_frames={round((scene["start"] + min(1.5, scene["duration"]/2))*FPS) for scene in STORY}
    gradient=Image.new("RGBA",(w,h))
    gd=ImageDraw.Draw(gradient)
    for y in range(h):
        top=45*(1-y/h)
        bottom=160*max(0,(y/h-.35)/.65)
        gd.line((0,y,w,y),fill=(10,17,20,round(max(top,bottom))))
    for f in range(FPS*SECONDS):
        t=f/FPS
        i=max(index for index, scene in enumerate(STORY) if t>=scene["start"])
        scene=STORY[i]
        local=t-scene["start"]
        if i!=last_scene:
            departing=previous
            last_scene=i
        if scene.get("clipIndex"):
            if i not in readers:
                readers[i]=subprocess.Popen(["ffmpeg","-hide_banner","-loglevel","error","-ss","0.4","-i",str(ROOT/f"clip{i}.mp4"),"-vf",f"fps={FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080","-frames:v",str(round(scene["duration"]*FPS)),"-pix_fmt","rgb24","-f","rawvideo","-"],stdout=subprocess.PIPE)
            data=readers[i].stdout.read(1920*1080*3)
            if len(data)!=1920*1080*3: raise RuntimeError(f"Short video frame: scene {i}, frame {f}")
            footage=Image.frombytes("RGB",(1920,1080),data)
            center=(.53 if i==0 else .58 if i==2 else .5,.5)
            full=fit(footage,(w,h),center)
            split=i in (1,3)
            dark=i==3
            base=INK if dark else PAPER
            im=Image.new("RGB",(w,h),base)
            d=ImageDraw.Draw(im)
            reveal=ease(local/.4)
            if not split:
                full.paste(gradient,(0,0),gradient)
                im.paste(full,(0,0))
                color=WHITE
                tx=margin
                ty=h*(.66 if portrait else .60)
                fs=w*(.114 if portrait else .067)
                if i==2: ty=h*(.19 if portrait else .16)
            else:
                color=WHITE if dark else INK
                if portrait:
                    box=(margin,h*.43,w-margin,h*.84)
                    if i==3:
                        # Keep the whole board table visible, not just the chairperson.
                        box=(margin,h*.43,w-margin,h*.43+(w-2*margin)*9/16)
                    tx,ty,fs=margin,h*.16,w*.135
                elif i==1:
                    box=(w*.48,margin,w-margin,h-margin)
                    tx,ty,fs=margin,h*.34,w*.083
                else:
                    box=(margin,margin,w*.55,h-margin)
                    tx,ty,fs=w*.59,h*.35,w*.057
                x1,y1,x2,y2=map(int,box)
                pic=fit(footage,(x2-x1,y2-y1),center)
                im.paste(pic,(x1,y1))
                d=ImageDraw.Draw(im)
                d.line((x1,y2+round(13*s),x1+round((x2-x1)*min(1,local/scene["duration"])),y2+round(13*s)),fill=ORANGE,width=round(2*s))
            d=ImageDraw.Draw(im)
            text(d,(margin,h*.055),"HUNTERAGENT / FIND YOUR WHAT IF",11*s,WHITE if dark or not split else INK,True)
            bars(d,w-margin-65*s,h*.048,23*s,ORANGE,ease(local*2))
            line_reveal(im,TITLES[i],tx,ty,fs,color,local)
            d=ImageDraw.Draw(im)
            underline=ease((local-.35)/.4)
            yline=ty+fs*2.25
            if not(portrait and split):
                d.line((tx,yline,tx+fs*2.6*underline,yline),fill=ORANGE,width=round(3*s))
            label = LABELS[i]
            if portrait:
                label=label.replace(" / ","\n")
                for j,l in enumerate(label.split("\n")): text(d,(margin,h*.88+j*18*s),l,10*s,color,True)
            else: text(d,(margin,h*.89),label,10*s,color,True)
            text(d,(w-margin,h*.94),f"0{i+1} / 04",10*s,color,True,"ra")
        else:
            im=Image.new("RGB",(w,h),PAPER)
            d=ImageDraw.Draw(im)
            graphic(d,w,h,local,0,(222,219,207),s)
            bars(d,margin,h*.08,36*s,ORANGE,ease(local*2))
            text(d,(margin+85*s,h*.085),"hunteragent.",24*s,INK)
            if scene.get("reflection"):
                lines=("Your next job","could change","more than your job.") if portrait else ("Your next job could change","more than your job.")
                fs=w*(.078 if portrait else .062)
                line_reveal(im,lines,margin,h*.38,fs,INK,local,reflection=True)
            else:
                line_reveal(im,scene["lines"],margin,h*(.31 if portrait else .29),w*(.16 if portrait else .105),INK,local)
                d=ImageDraw.Draw(im)
                y=h*.72 if portrait else h*.78
                text(d,(margin,y),"Dream-job possibilities.",20*s,INK)
                text(d,(margin,y+31*s),"In your inbox.",20*s,ORANGE)
                text(d,(margin,h*.9),"3 OR 5 POSSIBILITIES. ZERO PRESSURE.",9*s,INK,True)
                # Draw an envelope as the brand's five strokes settle into place.
                ex=w-margin-65*s;ey=h*.87
                p=ease((local-.4)/.5)
                if not portrait:
                    d.rectangle((ex,ey,ex+55*s,ey+35*s),outline=ORANGE,width=round(2*s))
                    d.line((ex,ey,ex+27*s,ey+21*s*p,ex+55*s,ey),fill=ORANGE,width=round(2*s))
        # Blend entire compositions, so images and motion type cross the cut together.
        if departing is not None and local<TRANSITION:
            im=Image.blend(departing,im,local/TRANSITION)
        previous=im
        if f in snapshot_frames:
            snap=fit(im,(576,1024) if portrait else (960,540))
            snap.save(ROOT/f"{'p' if portrait else 'l'}-{f}.jpg",quality=90)
            snapshots.append(snap)
        encoder.stdin.write(im.tobytes())
        if f%120==0: print(f"{target.name}: {f}/{FPS*SECONDS}",flush=True)
    encoder.stdin.close()
    if encoder.wait(): raise RuntimeError("Encoding failed")
    for reader in readers.values():
        reader.stdout.close()
        if reader.wait(): raise RuntimeError("Decode failed")
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(raw),"-i",str(ROOT/"sound.wav"),"-c:v","copy","-c:a","aac","-b:a","160k","-t",str(SECONDS),"-movflags","+faststart",str(target)],check=True)
    raw.unlink()
    return snapshots

if __name__=="__main__":
    render(False)
    render(True)
    print(f"Both {SECONDS}-second films rendered.",flush=True)
