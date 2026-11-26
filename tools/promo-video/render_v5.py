import math, os, subprocess, sys, wave, random, time
from pathlib import Path
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ROOT=Path(__file__).resolve().parent; SRC=ROOT/'assets'; OUT=ROOT/'work'; OUT.mkdir(exist_ok=True)
W,H=1920,1080; S=1.5; BW,BH=1280,720; FPS=30; DURATION=75
WHITE='#ffffff'; INK='#101e35'; MUTED='#60748c'; BLUE='#1266e3'; PURPLE='#7251df'; DARK='#0d1d38'; PALE='#edf4ff'; RED='#dc6159'; LINE='#dce6f2'
FONT=os.getenv('TRASOLVE_FONT_REGULAR','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'); BOLD=os.getenv('TRASOLVE_FONT_BOLD','/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')
FONT_INDEX=int(os.getenv('TRASOLVE_FONT_INDEX', '1'))
def clamp(x): return min(1,max(0,x))
def ease(x): return 1-(1-clamp(x))**3
def smooth(x): x=clamp(x); return x*x*(3-2*x)
def reveal(t,a=0,d=.65): return ease((t-a)/d)
def lerp(a,b,p): return a+(b-a)*p
def sc(x): return round(x*S)
def xy(b): return tuple(sc(x) for x in b)
@lru_cache(None)
def font(size,bold=False): return ImageFont.truetype(BOLD if bold else FONT,sc(size),index=FONT_INDEX)
@lru_cache(None)
def rgb(col): return tuple(int(col[i:i+2],16) for i in (1,3,5))
def mix(a,b,p): return tuple(round(lerp(x,y,p)) for x,y in zip(rgb(a),rgb(b)))
def text(im,x,y,s,size=24,color=INK,bold=False,anchor='lt',alpha=1):
    # text fade by mixing only when needed; use alpha layer for true opacity
    if alpha<=0: return
    d=ImageDraw.Draw(im); f=font(size,bold)
    if alpha>=.995: d.text((sc(x),sc(y)),s,font=f,fill=color,anchor=anchor,stroke_width=0)
    else:
        b=d.textbbox((0,0),s,font=f,anchor=anchor); ww=b[2]-b[0]+4; hh=b[3]-b[1]+4
        lay=Image.new('RGBA',(max(1,ww),max(1,hh))); ld=ImageDraw.Draw(lay); ld.text((2-b[0],2-b[1]),s,font=f,fill=(*rgb(color),round(alpha*255)),anchor=anchor)
        im.paste(lay,(sc(x)+b[0]-2,sc(y)+b[1]-2),lay)
def box(im,x,y,w,h,fill=WHITE,r=16,outline=None,width=1):
    if w<=0 or h<=0:return
    ImageDraw.Draw(im).rounded_rectangle(xy((x,y,x+w,y+h)),radius=sc(r),fill=fill,outline=outline,width=max(1,sc(width)))
def line(im,pts,color=BLUE,width=3):
    ImageDraw.Draw(im).line([xy(p) for p in pts],fill=color,width=max(1,sc(width)),joint='curve')
def circ(im,x,y,r,fill=BLUE,outline=None,width=1): ImageDraw.Draw(im).ellipse(xy((x-r,y-r,x+r,y+r)),fill=fill,outline=outline,width=max(1,sc(width)))
def pill(im,x,y,s,fill='#e8f1ff',color=BLUE,sz=15,pad=13):
    w=ImageDraw.Draw(im).textlength(s,font=font(sz,True))/S+pad*2;box(im,x,y,w,32,fill,16);text(im,x+w/2,y+16,s,sz,color,True,'mm');return w
def section(im,t,label,num,dark=False):
    c='#a1bce2' if dark else MUTED
    text(im,64,43,'TRASOLVE',15,'#95bcff' if dark else BLUE,True)
    text(im,184,43,'/  '+label,14,c,False)
    line(im,[(64,78),(1216,78)],'#28405f' if dark else '#dfe8f3',1)
def headline(im,lines,x=64,y=160,size=52,t=1,dark=False):
    for i,(s,c) in enumerate(lines):
        p=reveal(t,i*.16,.65);text(im,x,y+i*(size+14)+(1-p)*20,s,size,c or (WHITE if dark else INK),True,alpha=p)
def sub(im,lines,x=64,y=405,t=1,dark=False,size=20):
    for i,s in enumerate(lines):
        p=reveal(t,.25+i*.12,.6);text(im,x,y+i*(size+10)+(1-p)*10,s,size,'#a5bddc' if dark else MUTED,False,alpha=p)

# Soft gradients and fine architectural lines, precomputed once.
def make_bg(dark=False):
    w,h=W,H; xx=np.linspace(0,1,w,dtype=np.float32)[None,:]; yy=np.linspace(0,1,h,dtype=np.float32)[:,None]
    z=np.exp(-((xx-.82)**2/0.24+(yy-.40)**2/.32))*0.78
    a=np.array(rgb('#0c1830' if dark else '#fbfdff'),dtype=np.float32);b=np.array(rgb('#173a66' if dark else '#dcecff'),dtype=np.float32)
    arr=(a+z[...,None]*(b-a)).astype(np.uint8); im=Image.fromarray(arr,'RGB'); d=ImageDraw.Draw(im)
    for k in range(8):
        x=1040+k*52; d.line(xy((x,90,x-330,656)),fill='#203c61' if dark else '#e7effa',width=sc(1))
    return im
BG=make_bg(False); DB=make_bg(True)

# Schematic map, deliberately not a real road map.
MAPW,MAPH=730,475
@lru_cache(None)
def mapbase(w,h):
    im=Image.new('RGB',(sc(w),sc(h)),'#eef3f3');d=ImageDraw.Draw(im); random.seed(19)
    # abstract blocks and park patches
    for i in range(95):
        x=random.uniform(-.05,1.02)*w;y=random.uniform(-.02,1.0)*h;ww=random.uniform(24,78);hh=random.uniform(12,39)
        d.rounded_rectangle(xy((x,y,x+ww,y+hh)),radius=sc(3),fill=random.choice(['#e2ebe7','#e5ecea','#e9edef','#dae9e1','#edf0e9']))
    for k in range(-6,18):
        x=k*67;d.line(xy((x,-5,x+210,h+5)),fill='#ffffff',width=sc(10));d.line(xy((x,-5,x+210,h+5)),fill='#dfe6e4',width=sc(1))
    for k in range(-3,15):
        y=k*48;d.line(xy((-10,y,w+5,y-95)),fill='white',width=sc(8))
    pts=[(i*w/100,h*(.32+.09*math.sin(i/15)+.06*math.cos(i/22))) for i in range(101)]
    d.line([xy(p) for p in pts],fill='#b9dded',width=sc(48),joint='curve')
    d.line([xy(p) for p in pts],fill='#c7e5f0',width=sc(30),joint='curve')
    d.rounded_rectangle(xy((0,0,w-1,h-1)),radius=sc(18),outline='#d4e3ea',width=sc(1))
    return im
# coordinates correspond schematically to the 7 named destinations.
NAMES=['강남역','선릉과 정릉','봉은사','스타필드 코엑스몰','잠실한강공원','석촌호수','롯데월드타워']
TIMES=['09:00','10:05','11:37','12:38','14:13','15:17','16:19']
POINTS=[(.15,.77),(.33,.62),(.44,.42),(.48,.55),(.73,.32),(.82,.70),(.88,.52)]
BEFORE=[0,4,1,2,3,5,6]; AFTER=list(range(7))
def poly_partial(pts,p):
    if len(pts)<2 or p<=0:return []
    p=clamp(p); lens=[math.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(pts,pts[1:])]; left=sum(lens)*p; out=[pts[0]]
    for a,b,l in zip(pts,pts[1:],lens):
        if left>=l:out.append(b);left-=l
        else:out.append((lerp(a[0],b[0],left/l),lerp(a[1],b[1],left/l)));break
    return out

def mapdraw(im,x,y,w,h,order=None,t=1,color=BLUE,labels=True,old=None,transition=1,route=True):
    im.paste(mapbase(round(w),round(h)),xy((x,y)))
    pts=[(x+w*a,y+h*b) for a,b in POINTS]
    if old is not None and transition<1:
        p=[pts[i] for i in old];line(im,p,mix('#e6776d','#e1e8ee',transition),5)
    if order and route:
        path=poly_partial([pts[i] for i in order],t)
        if len(path)>1:
            line(im,path,'#ffffff',9);line(im,path,color,5)
    if order is None: order=AFTER
    for j,i in enumerate(order):
        p=reveal(t*1.4,j*.07,.25); a,b=pts[i]; r=17*p
        if r<1: continue
        circ(im,a,b,r+3,'#ffffff');circ(im,a,b,r,color)
        if labels and p>.75:text(im,a,b,str(j+1),15,WHITE,True,'mm')

# Actual service screen captures (v3); mask only debug metrics, preserve attribution.
imgs={i:Image.open(SRC/f'image{i}.jpg').convert('RGB') for i in range(1,7)}
for i in [1,4]:
    im=imgs[i]; d=ImageDraw.Draw(im)
    # cover result title and debug values in left pane with editorial label, not invented measurements
    d.rounded_rectangle((24,26,474,239),radius=10,fill='#eaf0f2')
    f1=ImageFont.truetype(BOLD,29,index=FONT_INDEX);f2=ImageFont.truetype(FONT,19,index=FONT_INDEX)
    d.text((42,56),'방문 순서 비교',font=f1,fill='#24324a');d.text((42,112),'Day 3  ·  7개 장소',font=f2,fill='#52637c')
    d.text((42,151),'예상 방문 시각 확인',font=f2,fill='#52637c')
    d.rounded_rectangle((691,800,1158,846),radius=6,fill='#eef0f3'); d.text((711,809),'방문 순서 확인',font=f2,fill='#52637c')

@lru_cache(None)
def image_scaled(i,w,h):
    im=imgs[i]; ratio=min(sc(w)/im.width,sc(h)/im.height); return im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS)
@lru_cache(None)
def shadow(w,h):
    im=Image.new('RGBA',(sc(w+60),sc(h+65)));d=ImageDraw.Draw(im);d.rounded_rectangle(xy((27,25,w+30,h+32)),radius=sc(18),fill=(29,59,98,45));return im.filter(ImageFilter.GaussianBlur(sc(15)))
def screen(im,i,x,y,w,h,t=1,tag='',accent=None):
    p=reveal(t,0,.7); x+=(1-p)*26; y+=(1-p)*22-3*smooth(t/4)
    img=image_scaled(i,round(w-16),round(h-43)); ww=img.width/S+16; hh=img.height/S+43
    sh=shadow(round(ww),round(hh));im.paste(sh,(sc(x-30),sc(y-19)),sh)
    box(im,x,y,ww,hh,WHITE,15,'#d7e4f0');
    for j,c in enumerate(['#d3dfeb','#d3dfeb','#d3dfeb']):circ(im,x+17+j*12,y+15,3,c)
    text(im,x+ww/2,y+16,'Trasolve',12,MUTED,True,'mm')
    im.paste(img,(sc(x+8),sc(y+31)))
    if accent:
        # accent image pixel region, outline only; no replacement of source data
        x0,y0,x1,y1=accent; k=img.width/S/1363; a=x+8+x0*k;b=y+31+y0*k; box(im,a,b,(x1-x0)*k,(y1-y0)*k,None,8,BLUE,3)
    return (x,y,ww,hh)

def list_panel(im,x,y,w,h,t,order=AFTER,old=None,move=1,showtime=True):
    box(im,x,y,w,h,WHITE,19,'#dce6f2');text(im,x+23,y+19,'서울 여행  ·  Day 3',18,INK,True)
    pill(im,x+w-100,y+12,'7개 장소','#eaf0ff',BLUE,12,8)
    line(im,[(x+20,y+57),(x+w-20,y+57)],LINE,1)
    rows=48; y0=y+67
    if old is None:old=order
    for i in order:
        newidx=order.index(i);oldidx=old.index(i);yy=y0+rows*lerp(oldidx,newidx,move)
        pp=reveal(t,newidx*.075,.4); xx=x+15+(1-pp)*20
        selected=i==4
        box(im,xx,yy,w-30,42,'#eef3ff' if selected else '#f6f9fc',10,'#dce7fc' if selected else None)
        num=(newidx if move>.5 else oldidx)+1
        circ(im,xx+21,yy+21,13,PURPLE if selected else BLUE)
        text(im,xx+21,yy+21,str(num),13,WHITE,True,'mm');text(im,xx+42,yy+20,NAMES[i],15,INK,True,'lm')
        if showtime:text(im,xx+w-43,yy+21,TIMES[i],14,PURPLE if selected else MUTED,True,'rm')

# small visual primitives
def place_card(im,x,y,w,title,subtitle,n,t=1):
    p=reveal(t);x+=(1-p)*40;y+=(1-p)*13
    box(im,x,y,w,80,WHITE,14,'#dce7f4');box(im,x+12,y+12,55,56,'#e6efff',12);circ(im,x+39,y+35,13,BLUE);circ(im,x+39,y+35,5,WHITE);line(im,[(x+39,y+48),(x+39,y+57)],BLUE,3)
    text(im,x+81,y+16,title,19,INK,True);text(im,x+81,y+45,subtitle,13,MUTED);pill(im,x+w-70,y+25,f'+ 저장','#edf4ff',BLUE,12,8)
def icon_clock(im,x,y,c):circ(im,x,y,22,'#e6f0ff');circ(im,x,y,14,'#e6f0ff',c,2);line(im,[(x,y-9),(x,y),(x+8,y+5)],c,2)
def icon_transit(im,x,y,c):circ(im,x,y,22,'#e6f0ff');box(im,x-12,y-13,24,23,None,5,c,2);line(im,[(x-8,y-4),(x+8,y-4)],c,2);circ(im,x-7,y+4,2,c);circ(im,x+7,y+4,2,c);line(im,[(x-8,y+10),(x-11,y+15)],c,2);line(im,[(x+8,y+10),(x+11,y+15)],c,2)
def condition(im,x,y,w,heading,value,kind,t=1):
    p=reveal(t);y+=(1-p)*26;box(im,x,y,w,104,WHITE,16,'#dce7f4');(icon_transit if kind=='train' else icon_clock)(im,x+40,y+40,BLUE)
    text(im,x+73,y+17,heading,17,MUTED,True);text(im,x+73,y+47,value,23,INK,True)
    line(im,[(x+20,y+87),(x+w-20,y+87)],'#e1eaf4',3);line(im,[(x+20,y+87),(x+20+(w-40)*p*.72,y+87)],BLUE,3)
def title_label(im,x,y,s,dark=False):pill(im,x,y,s,'#223d64' if dark else '#e7f0ff','#a9caff' if dark else BLUE,14,13)

def frame(t):
    # timestamps: 0 4 8 12 16 22 26 30 35 40 45 50 54 60 65 68 71 75
    if t<4:
        u=t; im=BG.copy();section(im,t,'여행 계획의 시작','01 / 06')
        title_label(im,64,121,'여행의 시작');headline(im,[('가고 싶은 곳을',None),('찾는 건 쉽습니다.',BLUE)],y=203,size=48,t=u)
        sub(im,['장소를 검색하고, 마음에 드는 곳을','저장하는 것은 익숙한 일이죠.'],y=366,t=u)
        x,y,w,h=600,133,616,490;box(im,x,y,w,h,WHITE,22,'#dce7f4');box(im,x+23,y+23,w-46,55,'#f0f5fb',12)
        circ(im,x+47,y+50,9,None,BLUE,2);line(im,[(x+54,y+57),(x+62,y+65)],BLUE,2)
        search='서울 가볼 만한 곳';text(im,x+76,y+50,search[:round(len(search)*clamp((u-.1)/1.1))],20,INK,True,'lm')
        for k,(a,b) in enumerate([('경복궁','역사 · 문화'),('봉은사','도심 속 사찰'),('석촌호수','산책 · 휴식')]):place_card(im,x+23,y+102+k*105,w-46,a,b,k,reveal(u,.45+k*.35,.7))
    elif t<8:
        u=t-4; im=BG.copy();section(im,t,'기존 지도 서비스','01 / 06');title_label(im,64,121,'기존 지도 서비스의 기능');headline(im,[('Google 지도와',None),('네이버 지도가 제공하는',None),('구간 길찾기.',BLUE)],y=174,size=40,t=u)
        sub(im,['출발지와 도착지를 지정하면','두 지점 사이의 이동 방법을 안내합니다.'],y=361,t=u)
        x,y,w,h=600,133,616,490;im.paste(mapbase(w,h),xy((x,y)));pts=[(x+90,y+370),(x+180,y+290),(x+240,y+290),(x+290,y+218),(x+410,y+212),(x+520,y+107)];ps=poly_partial(pts,reveal(u,.22,1.9));
        if len(ps)>1:line(im,ps,WHITE,12);line(im,ps,BLUE,7)
        for k,(a,b) in enumerate([pts[0],pts[-1]]):circ(im,a,b,22,BLUE if not k else PURPLE,WHITE,3);text(im,a,b,'A' if not k else 'B',19,WHITE,True,'mm')
        pill(im,x+17,y+17,'A → B','#ffffff',BLUE,15)
    elif t<12:
        u=t-8;im=BG.copy();section(im,t,'여행 계획의 문제','01 / 06');title_label(im,64,121,'길찾기의 한계');headline(im,[('하지만, 여행의',None),('방문 순서까지는',None),('정해주지 않습니다.',RED)],y=170,size=44,t=u)
        sub(im,['기존 지도 서비스에서 길을 찾더라도','여행 조건에 맞는 순서를 직접 정해야 합니다.'],y=370,t=u,size=19)
        mapdraw(im,600,133,616,490,BEFORE,reveal(u,.15,2.1),RED)
        pill(im,64,545,'길찾기 ≠ 방문 순서 결정','#ffedea','#bc514c',17)
    elif t<16:
        u=t-12;im=BG.copy();section(im,t,'여행 계획의 문제','01 / 06');title_label(im,64,121,'시간 제약조건');headline(im,[('고려할 조건은',None),('하나가 아닙니다.',BLUE)],y=181,size=48,t=u)
        sub(im,['단순히 가까운 곳부터 방문해도','운영 시간과 체류 시간이 맞지 않을 수 있습니다.'],y=335,t=u)
        for j,(a,b,k) in enumerate([('관광지 운영 시간','09:00 – 18:00','clock'),('장소별 체류 시간','1시간 30분','clock'),('대중교통 이동 시간','35분','train')]):condition(im,659,130+161*j,535,a,b,k,u-j*.28)
        text(im,64,565,'여행 계획에는 순서와 시간의 계산이 필요합니다.',20,INK,True,alpha=reveal(u,1,.7))
    elif t<22:
        u=t-16;im=DB.copy();section(im,t,'새로운 여행 플래너','02 / 06',True)
        title_label(im,64,130,'MEET TRASOLVE',True)
        headline(im,[('이제, 여행 계획의',WHITE),('새로운 방법.', '#86baff')],y=195,size=50,t=u,dark=True)
        text(im,64,355,'Trasolve',76,WHITE,True,alpha=reveal(u,.45,.9))
        sub(im,['장소를 고르는 순간부터,','방문 순서와 일정 설계까지.'],y=472,t=u,dark=True,size=22)
        # two feature cards on right
        for j,(n,h1,h2,col) in enumerate([('01','방문 순서 최적화','Visit Order Optimization',BLUE),('02','AI 여행 플래너','AI Travel Planner',PURPLE)]):
            p=reveal(u,.9+j*.35,.75);x=682+(1-p)*38;y=196+j*177;box(im,x,y,511,150,'#172e50',19,'#34547a');box(im,x+22,y+22,53,53,col,13);text(im,x+48,y+49,n,21,WHITE,True,'mm');text(im,x+92,y+30,h1,31,WHITE,True);text(im,x+92,y+82,h2,17,'#a3bce0')
    elif t<26:
        u=t-22;im=BG.copy();section(im,t,'지도 기반 일정 구성','03 / 06');title_label(im,64,126,'01  장소 검색 및 추가');headline(im,[('가고 싶은 곳을',None),('일정에 담으세요.',BLUE)],y=213,size=43,t=u);sub(im,['지도에서 장소를 찾고','날짜별 여행 일정에 추가합니다.'],y=350,t=u)
        screen(im,5,529,115,687,540,u,accent=(480,500,930,911))
        pill(im,64,525,'장소 검색  →  일정 추가','#e9f2ff',BLUE,15)
    elif t<30:
        u=t-26;im=BG.copy();section(im,t,'지도 기반 일정 구성','03 / 06');title_label(im,64,126,'02  여행 조건 설정');headline(im,[('시간도',None),('내 계획에 맞게.',BLUE)],y=208,size=48,t=u);sub(im,['방문 시작 시각과 체류 시간을','직접 조정할 수 있습니다.'],y=356,t=u)
        screen(im,2,529,115,687,540,u,accent=(485,449,936,794))
        pill(im,64,525,'방문 시간  ·  체류 시간','#e9f2ff',BLUE,15)
    elif t<35:
        u=t-30;im=BG.copy();section(im,t,'방문 순서 최적화','04 / 06');title_label(im,64,112,'핵심 기능 01');headline(im,[('어디로 갈지가 아닌,',None),('어떤 순서로 갈지.',BLUE)],y=163,size=42,t=u);sub(im,['같은 장소라도 방문 순서에 따라','여행 일정은 크게 달라집니다.'],y=294,t=u,size=19)
        mapdraw(im,562,122,654,497,BEFORE,reveal(u,.25,1.6),RED);pill(im,578,569,'최적화 전 방문 순서','#ffefee','#bb4e49',15)
        for k,idx in enumerate(BEFORE[:4]):
            pp=reveal(u,.5+k*.15,.45);xx=64+(1-pp)*22; yy=391+k*50;box(im,xx,yy,453,42,WHITE,10,'#e1e7ef');circ(im,xx+22,yy+21,13,RED);text(im,xx+22,yy+21,str(k+1),13,WHITE,True,'mm');text(im,xx+45,yy+20,NAMES[idx],16,INK,True,'lm')
    elif t<40:
        u=t-35;im=BG.copy();section(im,t,'방문 순서 최적화','04 / 06');title_label(im,64,118,'여행 조건 고려');headline(im,[('여행의 조건을',None),('함께 계산합니다.',BLUE)],y=185,size=46,t=u)
        sub(im,['관광지 운영 시간','장소별 체류 시간','대중교통 이동 시간'],y=332,t=u,size=23)
        screen(im,3,529,115,687,540,u,accent=(503,563,814,763))
        pill(im,64,531,'출발 시각 · 이동수단 · 방문 조건','#e8f1ff',BLUE,15)
    elif t<45:
        u=t-40;im=DB.copy();section(im,t,'방문 순서 최적화','04 / 06',True);title_label(im,64,110,'VISIT ORDER OPTIMIZATION',True)
        p=smooth((u-1.05)/2.15); text(im,64,163,'방문 순서를 자동으로 최적화합니다.',39,WHITE,True,alpha=reveal(u,0,.6))
        list_panel(im,64,232,430,421,u,AFTER,BEFORE,p,showtime=p>.96)
        order=BEFORE if p<.43 else AFTER
        mapdraw(im,523,232,693,421,order,1,RED if p<.43 else PURPLE,old=BEFORE if p>=.43 else None,transition=p,route=True)
        pill(im,1034,249,'계산 중' if p<.99 else '순서 재정렬 완료','#ffffff',PURPLE,15,12)
        # keep illustration designation visible in map; comparison list uses existing scene data
    elif t<50:
        u=t-45;im=BG.copy();section(im,t,'방문 순서 최적화','04 / 06');title_label(im,64,116,'최적화 결과');headline(im,[('정리된 방문 순서와',None),('예상 방문 시각.',BLUE)],y=195,size=40,t=u)
        sub(im,['잠실한강공원은 2번째에서','5번째 방문으로 재배치됩니다.'],y=333,t=u)
        box(im,64,447,426,112,WHITE,17,'#dce6f2');text(im,84,461,'잠실한강공원',17,INK,True);circ(im,114,515,22,RED);text(im,114,515,'2',22,WHITE,True,'mm');line(im,[(155,515),(352,515)],'#aac2e8',3);line(im,[(341,508),(352,515),(341,522)],'#aac2e8',3);circ(im,398,515,22,PURPLE);text(im,398,515,'5',22,WHITE,True,'mm')
        img=4 if u<1.45 else 1;screen(im,img,529,115,687,540,u if img==4 else u-1.45)
    elif t<54:
        u=t-50;im=DB.copy();section(im,t,'AI 여행 플래너','05 / 06',True);title_label(im,64,126,'핵심 기능 02',True);headline(im,[('복잡한 여행 계획,',WHITE),('이제 대화로.', '#97b9ff')],y=216,size=52,t=u,dark=True);sub(im,['여행 지도와 연결된 AI가','내 일정의 맥락을 이해하도록 설계했습니다.'],y=370,t=u,dark=True)
        # chat illustration
        x,y=670,160;box(im,x,y,526,434,'#172e50',24,'#35557b');circ(im,x+37,y+37,17,PURPLE);text(im,x+37,y+37,'✦',21,WHITE,True,'mm');text(im,x+65,y+36,'AI 여행 플래너',22,WHITE,True,'lm')
        p=reveal(u,.35,.7);box(im,x+100,y+91+(1-p)*15,400,84,'#284970',14);text(im,x+118,y+109,'오늘 여행 일정',22,WHITE,True,alpha=p);text(im,x+118,y+142,'방문 순서대로 정리해 줘.',20,'#d0e2ff',alpha=p)
        q=reveal(u,1.05,.8);box(im,x+24,y+207+(1-q)*18,474,156,'#213c60',14)
        for k,(nm,tt) in enumerate(zip(NAMES[:3],TIMES[:3])):text(im,x+46,y+226+k*39,tt+'   '+nm,19,'#d7e7ff',True,alpha=q)
    elif t<60:
        u=t-54;im=BG.copy();section(im,t,'AI 여행 플래너','05 / 06');title_label(im,64,115,'자연어로 질문');headline(im,[('내 일정에 맞춰',None),('AI에게 물어보세요.',BLUE)],y=189,size=43,t=u);sub(im,['현재 일정의 방문 순서와','예상 방문 시각을 정리해 줍니다.'],y=328,t=u)
        box(im,64,438,430,111,WHITE,16,'#dce6f2');text(im,84,450,'질문 예시',14,MUTED,True);s='Day 3 방문 순서를 정리해 줘.';text(im,84,482,s[:round(len(s)*clamp((u-.3)/1.7))],19,INK,True)
        screen(im,6,529,115,687,540,u,accent=(724,185,1325,240))
    elif t<65:
        u=t-60;im=BG.copy();section(im,t,'AI 여행 플래너','05 / 06');title_label(im,64,115,'일정 요약');headline(im,[('여행 일정의 맥락을',None),('한눈에 확인하세요.',BLUE)],y=189,size=41,t=u);sub(im,['방문 순서와 예상 방문 시각을','대화에서 바로 확인할 수 있습니다.'],y=327,t=u)
        for k in range(3):
            p=reveal(u,.25+k*.23,.4);y=428+k*55;box(im,64+(1-p)*20,y,427,45,WHITE,10,'#dfe7f3');text(im,84,y+22,TIMES[k],17,BLUE,True,'lm');text(im,160,y+22,NAMES[k],17,INK,True,'lm')
        screen(im,6,529,115,687,540,u,accent=(725,253,1120,508))
    elif t<68:
        u=t-65;im=BG.copy();section(im,t,'AI 여행 플래너','05 / 06');title_label(im,64,115,'AI 일정 편집');headline(im,[('요청부터 확인까지,',None),('대화로 이어지는 일정.',BLUE)],y=161,size=43,t=u);sub(im,['AI가 변경안을 제안하고 사용자가 확인하는 흐름.'],y=298,t=u)
        for k,(n,h1,h2) in enumerate([('01','자연어 요청','원하는 일정 말하기'),('02','변경안 확인','바뀔 내용 살펴보기'),('03','일정 적용','사용자가 결정하기')]):
            p=reveal(u,.2+k*.18,.6);x=64+k*395;y=385+(1-p)*18;box(im,x,y,362,183,WHITE,17,'#dce6f2');pill(im,x+21,y+20,n,'#e7f0ff',BLUE,14);text(im,x+21,y+71,h1,29,INK,True);text(im,x+21,y+123,h2,18,MUTED)
    elif t<71:
        u=t-68;im=DB.copy();section(im,t,'여행을 설계하는 두 가지 방법','06 / 06',True)
        headline(im,[('여행 계획을 더 간결하게.',WHITE)],x=64,y=145,size=50,t=u,dark=True)
        for k,(n,a,b,c) in enumerate([('01','방문 순서 최적화','Visit Order Optimization',BLUE),('02','AI 여행 플래너','AI Travel Planner',PURPLE)]):
            p=reveal(u,.18+k*.25,.6);x=64+k*587;y=295+(1-p)*25;box(im,x,y,565,240,'#172e50',22,'#35547b');box(im,x+28,y+27,62,62,c,16);text(im,x+59,y+58,n,25,WHITE,True,'mm');text(im,x+28,y+113,a,34,WHITE,True);text(im,x+28,y+167,b,20,'#aac5e7')
    else:
        u=t-71;im=BG.copy();
        # schematic dot-globe and animated connection curves; wordmark, no claim of final logo
        cx,cy,r=950,352,260
        d=ImageDraw.Draw(im)
        for j in range(-22,23):
            lat=j/22*math.pi/2; yy=cy+r*math.sin(lat);rr=r*math.cos(lat)
            for k in range(-29,30):
                lon=k/29*math.pi/2;xx=cx+rr*math.sin(lon)
                if xx>1219 or xx<650:continue
                dd=1.3+1.0*math.cos(lon);circ(im,xx,yy,dd,'#b7cfee')
        pts=[(822,240),(951,359),(1110,325)]
        for k in range(2):
            a,b=pts[k],pts[k+1];qq=[(lerp(a[0],b[0],j/50),lerp(a[1],b[1],j/50)-75*math.sin(math.pi*j/50)) for j in range(51)];path=poly_partial(qq,reveal(u,.1+k*.2,.9));
            if len(path)>1:line(im,path,BLUE,3)
        for x,y in pts:circ(im,x,y,7,BLUE,WHITE,2)
        text(im,64,133,'Trasolve',60,INK,True,alpha=reveal(u,0,.55));headline(im,[('가고 싶은 곳,',None),('이어지는 여행.',BLUE)],y=286,size=64,t=u)
        text(im,66,501,'방문 순서 최적화  ·  AI 여행 플래너',22,MUTED,True,alpha=reveal(u,.2,.5))
        pill(im,64,574,'trasolve.mangagaki.net','#e2eeff',BLUE,18,18)
    return im

# Short transitions between subscenes: crossfade over previous scene only during first 0.23 sec.
CUTS=[4,8,12,16,22,26,30,35,40,45,50,54,60,65,68,71]
@lru_cache(None)
def prev_frame(c):return frame(c-.035)
def render_frame(t):
    im=frame(t)
    for cut in CUTS:
        if cut<=t<cut+.23:
            im=Image.blend(prev_frame(cut),im,smooth((t-cut)/.23));break
    return im

def audio():
    sr=48000;n=sr*DURATION; y=np.zeros(n,dtype=np.float32);right=np.zeros(n,dtype=np.float32); bpm=112; beat=60/bpm
    rng=np.random.default_rng(127)
    # original gentle electronic bed: custom four-chord sequence, no sampled music.
    chords=[[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61]]
    def hz(note):return 440*2**((note-69)/12)
    def add(t0,sig,pan=0):
        i=int(t0*sr);j=min(n,i+len(sig));
        if j<=i:return
        sig=sig[:j-i];y[i:j]+=sig*(1-.30*pan);right[i:j]+=sig*(1+.30*pan)
    def tone(note,dur,vol,pan,pluck=True):
        tt=np.arange(int(dur*sr),dtype=np.float32)/sr; f=hz(note)
        if pluck: env=(1-np.exp(-tt*140))*np.exp(-tt*5.5)*np.minimum(1,(dur-tt)*8)
        else: env=np.minimum(1,tt*3)*np.minimum(1,(dur-tt)*2)
        sig=(np.sin(2*np.pi*f*tt)+.22*np.sin(2*np.pi*2*f*tt)+.10*np.sin(2*np.pi*3*f*tt))*env*vol
        return sig.astype(np.float32)
    for bar in range(math.ceil(DURATION/(beat*4))):
        start=bar*beat*4; ch=chords[bar%4];
        for k,no in enumerate(ch):add(start,tone(no,beat*4+.3,.028,(-1)**k*.65,False),(-1)**k*.65)
        for k in range(8):
            no=ch[[0,2,1,3,2,1,3,2][k]]+12;add(start+k*beat/2,tone(no,.82,.035,0),(-1)**k*.6)
        for k in range(4):
            a=start+k*beat;tt=np.arange(int(.23*sr),dtype=np.float32)/sr; kick=np.sin(2*np.pi*(48*tt+12*(1-np.exp(-tt*32))/32))*np.exp(-tt*20)*.075;add(a,kick)
            tt=np.arange(int(.075*sr),dtype=np.float32)/sr;hh=rng.normal(0,1,len(tt)).astype(np.float32);hh=np.diff(hh,prepend=0)*np.exp(-tt*65)*.008;add(a+beat/2,hh,.4)
    for start in [4,8,12,16,22,30,35,40,45,50,54,60,65,68,71]:
        tt=np.arange(int(.28*sr),dtype=np.float32)/sr;sig=(np.sin(2*np.pi*(520*tt+500*tt*tt))+0.22*np.sin(2*np.pi*1040*tt))*np.exp(-tt*16)*(1-np.exp(-tt*100))*.04;add(start,sig)
    envelope=np.minimum(1,np.arange(n)/sr/.7)*np.minimum(1,(n-np.arange(n))/sr/2.1)
    stereo=np.stack([y,right],axis=1)*envelope[:,None];stereo=stereo/(max(.8,np.abs(stereo).max())/.72);stereo=np.clip(stereo,-1,1)
    p=OUT/'music.wav';
    with wave.open(str(p),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((stereo*32767).astype('<i2').tobytes())
    return p

if __name__=='__main__':
    if '--preview' in sys.argv:
        times=[2.5,6.8,10.8,14.5,19.5,24.5,28.5,33.5,38.5,43.8,48,52.5,57.5,62.5,67,69.5,73.5]
        out=Image.new('RGB',(4*384,math.ceil(len(times)/4)*235),'#e5eaf0');d=ImageDraw.Draw(out)
        for k,t in enumerate(times):
            im=render_frame(t);im.resize((384,216),Image.Resampling.LANCZOS).save(OUT/f'frame_{t:.1f}.jpg',quality=93); x=k%4*384;y=k//4*235;out.paste(im.resize((384,216),Image.Resampling.LANCZOS),(x,y));d.text((x+7,y+217),f'{t:.1f}s',fill='black')
        out.save(OUT/'contact.jpg',quality=95); print('preview ready')
    else:
        a=audio(); output=ROOT/'Trasolve_75s_v5.mp4'; cmd=['ffmpeg','-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','-','-i',str(a),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','4','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(DURATION),str(output)]
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE); start=time.monotonic()
        for i in range(FPS*DURATION):
            im=render_frame(i/FPS);p.stdin.write(im.tobytes());
            if i%150==0: print(f'{i}/{FPS*DURATION} frames, {time.monotonic()-start:.1f}s',flush=True)
        p.stdin.close();ret=p.wait();print('render complete',ret,output,flush=True);sys.exit(ret)
