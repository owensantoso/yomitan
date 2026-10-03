#!/usr/bin/env python3
"""Codex assembly of Opus-authored illustrations and unchanged 1× fixture footage."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, hashlib, json, shutil, subprocess, zipfile
import motion_graphics_v2 as art
from compose import font

FPS=30
W,H=art.W,art.H
PLAN=[('stack',6,0),('before',5,0),('context-phone',4,0),('after',6,0),
      ('context-glasses',5,4),('glasses',5,0),('pipeline',7,0),('ambiguity',5,0),('end',3,0)]
LABELS={'before':('Ordinary lookup','The dictionary lists the meanings.','You still have to choose.'),
        'after':('JEV on','Here, it means making a call.','Sense #4 · to make (a call)'),
        'glasses':('JEV on','Here, it means putting on glasses.','Sense #3 · to put on (glasses, etc.)'),
        'ambiguity':('JEV on','This one needs more context.','JEV chose “unclear”. No highlight.')}


def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def load_inputs(manifest_path,evidence_path):
    mp=Path(manifest_path).resolve();m=json.loads(mp.read_text())
    for clip in m['clips'].values():
        p=Path(clip['path']);clip['path']=str((mp.parent/p).resolve() if not p.is_absolute() else p)
        if not Path(clip['path']).is_file():raise FileNotFoundError(clip['path'])
    return m,json.loads(Path(evidence_path).read_text())


def decoder(clip,duration):
    x,y,w,h=clip['crop'];bg='0x'+''.join(f'{v:02x}' for v in art.BG)
    vf=f'crop={w}:{h}:{x}:{y},scale=952:740:force_original_aspect_ratio=decrease,pad=952:740:(ow-iw)/2:(oh-ih)/2:color={bg},fps={FPS},tpad=stop_mode=clone:stop_duration={duration}'
    source_duration=min(duration,clip.get('end',clip['start']+duration)-clip['start'])
    return subprocess.Popen([shutil.which('ffmpeg') or 'ffmpeg','-v','error','-ss',str(clip['start']),'-t',str(source_duration),'-i',clip['path'],'-vf',vf,'-t',str(duration),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)


def recording_canvas(kind,clip,raw,t=3,number=None):
    im=Image.new('RGB',(W,H),art.BG);d=ImageDraw.Draw(im)
    a,b,c=LABELS[kind]
    if kind=='after' and t<.35:a='Turning JEV on'
    art.say(d,(64,52),'Yomitan · '+a,28,art.SOFT)
    s=clip['sentence'];size=52
    while d.textlength(s,font=font(size,jp=True))>952:size-=1
    art.say(d,(64,112),s,size,jp=True)
    im.paste(raw,(64,218))
    art.say(d,(64,1006),b,44)
    if kind!='after' or t>1.2:art.say(d,(64,1070),c,36,art.SOFT)
    if kind=='before':art.say(d,(64,1122),'Same fork, JEV switched off.',28,art.SOFT)
    label='Actual browser recording · 1×' if kind=='before' else 'Actual browser recording · 1× · model scores, not accuracy'
    art.say(d,(64,1160),label,28,art.SOFT)
    if number:art.say(d,(906,20),f'{number:02d} / 07',28,art.SOFT)
    return im


def recording_frames(kind,clip,duration):
    p=decoder(clip,duration);last=None;framebytes=952*740*3
    try:
        for n in range(round(duration*FPS)):
            raw=p.stdout.read(framebytes)
            if len(raw)==framebytes:last=Image.frombytes('RGB',(952,740),raw)
            if last is None:raise RuntimeError('Empty fixture decoder: '+Path(clip['path']).name)
            yield recording_canvas(kind,clip,last,n/FPS)
    finally:
        p.stdout.close();code=p.wait(timeout=30)
        if code:raise RuntimeError('Fixture decoder failed: '+str(code))


def proof_frame(kind,clip):
    # Only curated isolated fixture recording; no screenshot from personal Chrome.
    c=dict(clip);c['start']+=3
    p=decoder(c,.2);data=p.stdout.read();p.stdout.close()
    if p.wait(timeout=30):raise RuntimeError('Proof decoder failed')
    framebytes=952*740*3
    if len(data)<framebytes:raise RuntimeError('Empty proof decoder')
    raw=Image.frombytes('RGB',(952,740),data[-framebytes:])
    im=recording_canvas(kind,clip,raw,t=3)
    d=ImageDraw.Draw(im);d.rectangle((64,1140,W-64,1210),fill=art.BG)
    art.say(d,(64,1160),'Actual popup · model scores, not accuracy',28,art.SOFT)
    return im


def export_carousel(ev,m,out):
    frames=art.carousel_frames(ev)
    frames[2]=proof_frame('after',m['clips']['after'])
    frames[3]=proof_frame('glasses',m['clips']['glasses'])
    frames[5]=proof_frame('ambiguity',m['clips']['ambiguity'])
    files=[]
    for i,im in enumerate(frames,1):
        # Apply one consistent number, replacing the illustration's own tag.
        d=ImageDraw.Draw(im);d.rectangle((850,0,W,64),fill=art.BG)
        tag=f'{i:02d} / 07';art.say(d,(W-64-d.textlength(tag,font=font(28)),32),tag,28,art.SOFT)
        p=out/f'carousel-{i:02d}.png';im.save(p);files.append(p)
    frames[0].save(out/'yomitan-jev-carousel.pdf',save_all=True,append_images=frames[1:],resolution=144)
    with zipfile.ZipFile(out/'yomitan-jev-carousel.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in files:z.write(p,p.name)
    frames[2].save(out/'yomitan-jev-poster-v2.png')


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',required=True);ap.add_argument('--evidence',required=True);ap.add_argument('--out-dir',required=True)
    g=ap.add_mutually_exclusive_group(required=True);g.add_argument('--samples',action='store_true');g.add_argument('--render',action='store_true');a=ap.parse_args()
    m,ev=load_inputs(a.manifest,a.evidence);out=Path(a.out_dir);out.mkdir(parents=True,exist_ok=True)
    export_carousel(ev,m,out)
    review=out/'review';review.mkdir(exist_ok=True)
    if a.samples:
        for kind,dur in art.SCENES.items():
            for name,t in [('start',0),('middle',dur/2),('end',dur-.001)]:art.scene_frame(kind,t,ev).save(review/f'{kind}-{name}.png')
        for t in [2.2,2.9,4.8,5.0,5.3]:art.scene_frame('stack' if t<3.4 else 'context',t,ev).save(review/f'motion-{t:.1f}.png')
        print('Samples and carousel: '+str(out),flush=True);return
    duration=sum(x[1] for x in PLAN);assert 35<=duration<=55
    video=out/'yomitan-jev-demo-v2.mp4'
    enc=subprocess.Popen([shutil.which('ffmpeg') or 'ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],stdin=subprocess.PIPE)
    cursor=0;receipt=[]
    try:
        for kind,dur,offset in PLAN:
            print(f'{cursor:02d}–{cursor+dur:02d}s {kind}',flush=True)
            real=kind in m['clips'];scene='context' if kind.startswith('context-') else kind
            frames=recording_frames(kind,m['clips'][kind],dur) if real else (art.scene_frame(scene,n/FPS+offset,ev) for n in range(dur*FPS))
            for n,im in enumerate(frames):
                if n in [0,1,int(dur*FPS/2),dur*FPS-1]:im.save(review/f'{cursor+n/FPS:06.2f}-{kind}.png')
                enc.stdin.write(im.tobytes())
            c=m['clips'].get(kind);entry={'scene':kind,'start_seconds':cursor,'duration_seconds':dur,'kind':'actual recording' if real else 'simplified illustration'}
            if c:entry.update(source_basename=Path(c['path']).name,source_sha256=digest(c['path']),source_start=c['start'],source_end=c.get('end'),crop=c['crop'],playback_speed=1)
            receipt.append(entry);cursor+=dur
    finally:enc.stdin.close()
    if enc.wait(timeout=60):raise RuntimeError('Encoder failed')
    data={'duration_seconds':duration,'fps':FPS,'resolution':[W,H],'audio':'none','scenes':receipt,'manifest_sha256':digest(a.manifest),'evidence_sha256':digest(a.evidence),'video_sha256':digest(video),'sources':{n:digest(Path(__file__).parent/n) for n in ['motion_graphics_v2.py','render_v2.py']},'claims':'Three demonstrated examples, no benchmark or measured accuracy claim. Actual popup recording remains 1×; illustrated choices use original source IDs.'}
    (out/'video-edit-receipt-v2.json').write_text(json.dumps(data,indent=2))
    print(video,flush=True)

if __name__=='__main__':main()
