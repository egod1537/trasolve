"""75-second Trasolve revision; clarifies the purpose of the directions comparison."""
import argparse
import math
import subprocess
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from render_v5 import (W,H,S,DURATION,ROOT,OUT,NAMES,TIMES,BEFORE,AFTER,imgs,audio,
    box,circ,line,text,font,xy,sc,rgb,clamp,smooth,reveal,lerp,poly_partial)

INK='#13223c'; WHITE='#ffffff'; BLUE='#2463eb'; LAV='#c7b9ff'; VIOLET='#7453df'
RED='#d96360'; MUTED='#61748f'; DARK='#101d36'
FPS=60
CUTS=[0,4,8,12,16,22,26,30,35,40,45,50,54,60,65,68,71,75]

def p(t,a=0,d=.6): return reveal(t,a,d)

def center(im,x,y,s,z=32,col=INK,b=True,q=1):
    text(im,x,y+20*(1-q),s,z,col,b,'mm',q)

def badge(im,x,y,s,col=BLUE,fill=WHITE,z=18):
    w=ImageDraw.Draw(im).textlength(s,font=font(z,True))/S+36
    box(im,x-w/2,y-21,w,42,fill,21);center(im,x,y,s,z,col)

def arc(im,x,y,r,start,end,color,width=2):
    ImageDraw.Draw(im).arc(xy((x-r,y-r,x+r,y+r)),start,end,fill=color,width=sc(width))

def curve(a,b,lift=50):
    return [(lerp(a[0],b[0],i/40),lerp(a[1],b[1],i/40)-lift*math.sin(math.pi*i/40)) for i in range(41)]

def path(im,points,q,col,width=5,head=False):
    part=poly_partial(points,q)
    if len(part)>1:
        line(im,part,col,width)
        if head:
            x,y=part[-1];circ(im,x,y,width+3,WHITE);circ(im,x,y,width,col)

def pin(im,x,y,n,col=BLUE,k=1):
    r=21*k
    if r<1:return
    circ(im,x,y,r+3,WHITE);circ(im,x,y,r,col)
    if k>.55:center(im,x,y,str(n),20,WHITE)

def spark(im,x,y,r,col):
    ImageDraw.Draw(im).polygon([xy((x,y-r)),xy((x+r*.25,y-r*.25)),xy((x+r,y)),xy((x+r*.25,y+r*.25)),xy((x,y+r)),xy((x-r*.25,y+r*.25)),xy((x-r,y)),xy((x-r*.25,y-r*.25))],fill=col)

@lru_cache(maxsize=5)
def bg(style):
    a,b,c={'light':('#f8fbff','#dceaff','#d2e1f8'),'dark':('#111c35','#254477','#29436b'),
    'blue':('#184ac7','#3786f3','#4b85ed'),'violet':('#211a44','#4c3b98','#6751ad'),
    'warm':('#fff8f5','#ffddd6','#f0d6ce')}[style]
    x=np.linspace(0,1,W,dtype=np.float32)[None,:];y=np.linspace(0,1,H,dtype=np.float32)[:,None]
    g=np.exp(-((x-.8)**2/.22+(y-.35)**2/.42))*.85
    im=Image.fromarray((np.array(rgb(a))+g[...,None]*(np.array(rgb(b))-np.array(rgb(a)))).astype(np.uint8),'RGB')
    d=ImageDraw.Draw(im)
    for yy in range(20,720,44):
        for xx in range(20,1280,44):d.ellipse(xy((xx,yy,xx+1.3,yy+1.3)),fill=c)
    return im

def orbit(im,cx,cy,t,col,bright,radii=(100,170,245)):
    for k,r in enumerate(radii):
        circ(im,cx,cy,r,None,col,1);a=t*(.32+k*.18)+k*1.9
        arc(im,cx,cy,r,math.degrees(a),math.degrees(a)+63,bright,2)
        circ(im,cx+r*math.cos(a),cy+r*math.sin(a),4+k,bright)

def rings(im,x,y,t,col,r=29):
    for i in range(2):
        q=(t*.6+i*.5)%1
        if q<.96:circ(im,x,y,r+q*30,None,col,1)

@lru_cache(maxsize=20)
def screenshot(i,pixel_width):
    src=imgs[i]
    return src.resize((pixel_width,round(pixel_width*src.height/src.width)),Image.Resampling.LANCZOS)

def shot(im,i,cx,cy,w,t,accent=None):
    q=p(t,0,.75);cx+=22*(1-q);cy+=30*(1-q)
    # Scale at the output-pixel level so the slow push-in stays smooth at 60 fps.
    pixel_width=sc(w*(.94+.06*smooth(t/3.6)))
    pic=screenshot(i,pixel_width);w=pic.width/S;h=pic.height/S;x=cx-w/2;y=cy-h/2
    box(im,x-11,y-22,w+22,h+40,'#becde5',19)
    box(im,x-7,y-28,w+14,h+35,WHITE,17,'#c9d9ee')
    for j in range(3):circ(im,x+9+j*12,y-13,3.3,'#ccd8e8')
    center(im,cx,y-13,'Trasolve',12,MUTED)
    im.paste(pic,xy((x,y)))
    if accent:
        ax,ay,bx,by=accent;k=w/imgs[i].width
        box(im,x+ax*k,y+ay*k,(bx-ax)*k,(by-ay)*k,None,8,BLUE,2+1.5*(.5+.5*math.sin(t*4)))
    return x,y,w,h

def pointer(im,x,y,t):
    ImageDraw.Draw(im).polygon([xy((x,y)),xy((x+6,y+26)),xy((x+12,y+17)),xy((x+21,y+23)),xy((x+25,y+17))],fill=INK,outline=WHITE,width=sc(2))
    if 0<t<.65:circ(im,x,y,10+t/.65*33,None,BLUE,2)

def clock(im,x,y,r,t,mode):
    circ(im,x,y,r,'#edf3ff','#d3e0f8',2)
    for k in range(12):
        a=k*math.pi/6;line(im,[(x+(r-12)*math.sin(a),y-(r-12)*math.cos(a)),(x+(r-5)*math.sin(a),y-(r-5)*math.cos(a))],'#a8bddf',2)
    a=(min(t,2)*1.8+mode)*math.pi/3
    for length,ang in [(r*.47,a*.45),(r*.71,a)]:line(im,[(x,y),(x+length*math.sin(ang),y-length*math.cos(ang))],BLUE,4)
    circ(im,x,y,5,BLUE)


def opening(t, *, first_line='가고 싶은 곳을',
            conditions_title='고려할 조건은 하나가 아닙니다.',
            conditions_summary='순서와 시간, 함께 계산해야 합니다.'):
    if t<4:
        u=t;im=bg('light').copy()
        center(im,640,100,first_line,61,INK,q=p(u));center(im,640,174,'찾는 건 쉽습니다.',69,BLUE,q=p(u,.2))
        q=p(u,.5,.6);y=248+30*(1-q);box(im,325,y,630,65,WHITE,32,'#c5d6ef',2)
        circ(im,361,y+32,12,None,BLUE,2);line(im,[(369,y+41),(381,y+53)],BLUE,3)
        s='서울 가볼 만한 곳';n=int(len(s)*clamp((u-.65)/.9));text(im,400,y+32,s[:n]+('|' if n<len(s) else ''),25,INK,True,'lm')
        for j,(name,detail) in enumerate([('경복궁','역사 · 문화'),('봉은사','도심 속 사찰'),('석촌호수','산책 · 휴식')]):
            q=p(u,1.1+j*.2,.55)
            if q<=0:continue
            x=72+j*386+35*(1-q);yy=384+16*math.sin(u*1.6+j*1.8)+35*(1-q)
            box(im,x+4,yy+7,358,88,'#d6e2f5',17);box(im,x,yy,358,88,WHITE,17,'#dbe5f5')
            circ(im,x+40,yy+44,22,BLUE);center(im,x+40,yy+44,'+',27,WHITE)
            text(im,x+77,yy+17,name,24,INK,True);text(im,x+77,yy+52,detail,16,MUTED)
            path(im,curve((x+179,yy+88),(640,584),-12),p(u,2.05+j*.1,.65),'#8fb3f4',2)
        if u>1.9:badge(im,640,606,'가고 싶은 장소를 저장',BLUE,WHITE,21)
    elif t<8:
        u=t-4;im=bg('dark').copy()
        center(im,640,76,'Google 지도 · 네이버 지도  /  일반 길찾기',30,'#bfd6ff',q=p(u))
        center(im,640,158,'구간 길찾기만 제공합니다.',61,WHITE,q=p(u,.12))
        # Contrast the solved point-to-point leg with the still-unsolved visit order.
        box(im,72,249,548,300,'#1a304f',22,'#365680',1)
        box(im,660,249,548,300,'#1a304f',22,'#365680',1)
        center(im,346,286,'두 지점 사이의 경로',22,'#c0d6ff',q=p(u,.25))
        center(im,934,286,'여러 장소의 방문 순서',22,'#c0d6ff',q=p(u,.45))
        pts=[(139,443),(218,443),(275,385),(341,385),(409,347),(464,347),(550,406)]
        for a,b in zip(pts,pts[1:]):line(im,[a,b],'#324b73',13)
        path(im,pts,p(u,.45,1.35),'#79b4ff',7,True)
        for i,(x,y) in enumerate([pts[0],pts[-1]]):
            rings(im,x,y,u,'#5077bb',26);pin(im,x,y,'AB'[i],BLUE if i==0 else VIOLET,1.05)
        center(im,139,505,'출발지',18,'#dce8ff');center(im,550,505,'도착지',18,'#dce8ff')
        nodes=[(742,377),(879,343),(1090,376),(790,484),(1090,484)]
        for j,(x,y) in enumerate(nodes):
            k=p(u,.65+j*.1,.5)
            if k>0:
                circ(im,x,y,21*k+3,'#29466c');circ(im,x,y,20*k,None,'#95a9c8',2)
                if k>.65:center(im,x,y,'ABCDE'[j],17,'#dce8ff')
        center(im,949,424,'?',80,'#f0b3a7',q=p(u,1.0,.6))
        center(im,640,623,'여행 전체의 방문 순서는 직접 결정해야 합니다.',34,'#f2bdad',True,p(u,1.15,.55))
    elif t<12:
        u=t-8;im=bg('warm').copy();center(im,640,81,'하지만, 어떤 순서로 방문해야 할까요?',53,INK,q=p(u))
        pts=[(158,366),(356,262),(498,460),(657,250),(820,446),(980,241),(1125,370)];order=[0,5,1,6,2,4,3]
        path(im,[pts[i] for i in order],p(u,.35,1.6),RED,6,True)
        for j,i in enumerate(order):
            x,y=pts[i];pin(im,x,y,j+1,RED,p(u,j*.1,.4))
            if u>1.4:center(im,x,y+48,'ABCDEFG'[i],21,'#a65b58')
        q=p(u,.45,.55);box(im,82,536+30*(1-q),1116,126,WHITE,23,'#f3d3cb')
        center(im,640,564,'Google 지도와 네이버 지도의 일반 구간 길찾기는',26,INK,q=q)
        center(im,640,607,'여행 조건에 맞는 방문 순서를 정해주지 않습니다.',35,'#b94e49',q=q)
        center(im,640,641,'방문 순서는 여행자가 직접 결정해야 합니다.',18,MUTED,False,q)
    else:
        u=t-12;im=bg('light').copy();center(im,640,85,conditions_title,52,INK,q=p(u))
        for j,(head,val) in enumerate([('관광지 운영 시간','09:00 – 18:00'),('장소별 체류 시간','1시간 30분'),('대중교통 이동 시간','35분')]):
            q=p(u,.15+j*.24,.7);x=75+j*390;y=180+65*(1-q)
            box(im,x+4,y+9,350,326,'#dae5f8',25);box(im,x,y,350,326,WHITE,25,'#d9e5fa');cx=x+175;cy=y+106
            if j<2:clock(im,cx,cy,67,max(0,u-.2*j),j)
            else:
                circ(im,cx,cy,66,'#eef3ff','#d4e1fb',2);box(im,cx-36,cy-39,72,67,None,12,BLUE,4);line(im,[(cx-30,cy-15),(cx+30,cy-15)],BLUE,3)
                for a in [-18,18]:circ(im,cx+a,cy+13,5,BLUE);line(im,[(cx+a,cy+27),(cx+a*1.3,cy+41)],BLUE,3)
                for k in range(3):line(im,[(cx-94-(u*40+k*15)%35,cy-28+k*20),(cx-76,cy-28+k*20)],'#8eb3f2',2)
            center(im,cx,y+208,head,23,MUTED);center(im,cx,y+258,val,31,INK)
        center(im,640,605,conditions_summary,36,BLUE,q=p(u,1.25))
    return im


def product(t):
    if t<22:
        u=t-16;im=bg('blue').copy();orbit(im,640,298,u,'#5289e9','#acd2ff',(120,220,330))
        center(im,640,155,'구간 길찾기는 물론,',40,'#e4eeff',q=p(u));center(im,640,218,'방문 순서까지 최적화합니다.',53,WHITE,q=p(u,.22))
        center(im,640,351,'Trasolve',105,WHITE,q=p(u,.5,.9))
        for j,(s,c) in enumerate([('방문 순서 최적화',BLUE),('AI 여행 플래너',VIOLET)]):
            q=p(u,2+j*.3,.6)
            if q>0:badge(im,332+j*616,542+32*(1-q),s,c,WHITE,29)
        center(im,640,642,'길찾기부터 방문 순서 결정, AI 여행 계획까지.',26,WHITE,False,p(u,2.5))
    elif t<26:
        u=t-22;im=bg('light').copy();center(im,640,62,'가고 싶은 곳을 일정에 담으세요.',48,INK,q=p(u))
        shot(im,5,640,386,755,u,accent=(480,500,930,911) if u>1.1 else None)
        q=p(u,.8,.65);badge(im,165-35*(1-q),240,'장소 검색',BLUE,WHITE,21);path(im,[(235,242),(310,242),(340,280)],q,BLUE,3)
        q=p(u,2,.7);badge(im,1115+35*(1-q),484,'일정 추가',BLUE,WHITE,21);path(im,[(1030,484),(984,484),(950,458)],q,BLUE,3)
        pointer(im,lerp(995,724,smooth((u-1.35)/.75)),lerp(360,529,smooth((u-1.35)/.75)),u-2.1)
    else:
        u=t-26;im=bg('dark').copy();shot(im,2,406,382,720,u,accent=(485,449,936,794) if u>.65 else None)
        text(im,825,111,'TRIP PLANNING',15,'#97b7f1',True);text(im,825,148,'시간도',51,WHITE,True,alpha=p(u));text(im,825,216,'내 계획에 맞게.',39,LAV,True,alpha=p(u,.2))
        for j,(s,a,b) in enumerate([('방문 시작','09:30','09:40'),('체류 시간','2시간','1시간 50분')]):
            q=p(u,.45+j*.35,.6);x=825;y=338+j*116+30*(1-q);box(im,x,y,390,96,'#233a62',19,'#405a87')
            text(im,x+18,y+13,s,17,'#aac3ee',True);text(im,x+18,y+45,b if u>1.6+j*.45 else a,28,WHITE,True)
            z=smooth((u-1-j*.35)/.8);line(im,[(x+245,y+62),(x+360,y+62)],'#506b9b',4);circ(im,x+245+115*z,y+62,8,'#91c2ff')
    return im


def optimization(t):
    if t<35:
        u=t-30;im=bg('violet').copy();center(im,640,98,'방문 순서 최적화',25,LAV,q=p(u))
        center(im,640,215,'구간 길찾기를 넘어,',67,WHITE,q=p(u,.1));center(im,640,306,'방문 순서까지.',86,LAV,q=p(u,.55))
        pts=[(115+j*175,520+32*math.sin(j*1.8)) for j in range(7)];path(im,[pts[i] for i in BEFORE],p(u,1.1,1.1),'#ed908d',5,True)
        for k,i in enumerate(BEFORE):pin(im,*pts[i],k+1,RED,p(u,1.1+k*.08,.4))
        center(im,640,652,'같은 장소도 방문 순서에 따라 달라지는 일정.',24,'#e2dcff',False,p(u,1.65))
    elif t<40:
        u=t-35;im=bg('light').copy();center(im,640,63,'여행의 조건을 함께 계산합니다.',49,INK,q=p(u))
        shot(im,3,640,370,735,u,accent=(503,563,814,763) if u>1 else None)
        for j,(x,y,s) in enumerate([(165,226,'운영 시간'),(1110,245,'대중교통'),(1090,536,'체류 시간')]):
            q=p(u,.55+j*.4,.55)
            if q>0:badge(im,x+25*(1-q),y+25*(1-q),s,BLUE,WHITE,21)
        pointer(im,lerp(820,760,smooth((u-1.1)/1.4)),lerp(550,493,smooth((u-1.1)/1.4)),u-2.5)
        center(im,640,675,'출발 시각 · 이동수단 · 방문 조건',21,MUTED,q=p(u,.7))
    elif t<45:
        u=t-40;im=bg('dark').copy();center(im,640,60,'방문 순서를 자동으로 최적화',48,WHITE,q=p(u))
        # Same fixed nodes; only order and route change. Cards move along staggered arcs.
        pts=[(132,370),(315,280),(493,351),(655,217),(825,352),(1010,265),(1150,385)]
        q=smooth((u-1.05)/2.1)
        if q<.99:path(im,[pts[i] for i in BEFORE],1,'#9a505f' if q<.55 else '#3e496a',5)
        if q>.03:path(im,[pts[i] for i in AFTER],q,'#a697ff',7,True)
        for i,(x,y) in enumerate(pts):
            if i==4:rings(im,x,y,u,'#9c89e7',25)
            pin(im,x,y,(BEFORE.index(i) if q<.5 else AFTER.index(i))+1,VIOLET if q>.5 else RED,1.14)
            center(im,x,y+52,NAMES[i].replace('스타필드 ',''),17,'#d9e5ff')
        for i in [j for j in AFTER if j!=4]+[4]:
            old=BEFORE.index(i);new=AFTER.index(i);v=smooth((u-1.05-.07*(i%3))/1.85)
            x=100+lerp(old,new,v)*157;y=538-(72 if i==4 else 21)*math.sin(math.pi*v)
            box(im,x,y,137,96,'#7457df' if i==4 else '#273e65',14,'#8395bd' if i==4 else '#46618c')
            center(im,x+68.5,y+30,str((old if v<.5 else new)+1),26,WHITE)
            center(im,x+68.5,y+66,NAMES[i].replace('스타필드 ','').replace('선릉과 정릉','선릉·정릉'),14,WHITE)
        center(im,640,680,'순서 재정렬 완료' if q>.99 else '운영 시간과 이동 조건을 반영하는 방문 순서',20,LAV,q=p(u,.65))
    else:
        u=t-45;im=bg('light').copy();center(im,640,61,'정리된 방문 순서와 예상 방문 시각',45,INK,q=p(u))
        shot(im,4,330,345,510,u);shot(im,1,950,345,510,max(0,u-.36))
        badge(im,330,127,'최적화 전','#b64d51',WHITE,19);badge(im,950,127,'최적화 후',VIOLET,WHITE,19)
        path(im,[(604,345),(676,345)],p(u,.7,.6),BLUE,5,True)
        q=p(u,1.3,.6);box(im,400,555+25*(1-q),480,108,WHITE,20,'#d4e0f6');center(im,640,579,'잠실한강공원',21,MUTED,q=q)
        pin(im,508,623,2,RED);path(im,[(548,623),(732,623)],q,BLUE,4,True);pin(im,772,623,5,VIOLET,q)
    return im


def ai(t):
    if t<54:
        u=t-50;im=bg('violet').copy();orbit(im,640,250,u,'#6b58a7','#c8b9ff',(77,128,183))
        r=76+6*math.sin(u*2.7);circ(im,640,250,r,VIOLET,'#bba9ff',2);spark(im,640,250,44,WHITE);spark(im,735,171,13+3*math.sin(u*3),LAV);spark(im,550,343,10,LAV)
        center(im,640,77,'AI 여행 플래너',25,LAV,q=p(u));center(im,640,480,'복잡한 여행 계획,',61,WHITE,q=p(u,.25));center(im,640,558,'이제 대화로.',78,'#d4c7ff',q=p(u,.6))
    elif t<60:
        u=t-54;im=bg('light').copy();center(im,640,65,'내 일정에 맞춰 AI에게 물어보세요.',47,INK,q=p(u))
        shot(im,6,420,367,700,u,accent=(724,185,1325,240) if u>2.2 else None)
        x=815;y=240+35*(1-p(u,.65,.55));box(im,x,y,395,180,WHITE,23,'#d8e4f8')
        circ(im,x+35,y+34,18,VIOLET);spark(im,x+35,y+34,11,WHITE);text(im,x+64,y+34,'AI 여행 플래너',20,INK,True,'lm')
        s='Day 3 방문 순서를';s2='정리해 줘.';n=int((len(s)+len(s2))*clamp((u-.8)/1.7));text(im,x+22,y+84,s[:n],25,INK,True);text(im,x+22,y+119,s2[:max(0,n-len(s))],25,INK,True)
        if 2.5<u<4.1:
            for i in range(3):circ(im,x+29+i*20,y+220,5+2*math.sin(u*5-i),VIOLET)
        if u>4.1:
            q=p(u,4.1,.5);badge(im,1012,510+22*(1-q),'현재 일정과 연결된 AI',VIOLET,WHITE,20)
            path(im,[(815,490),(785,490),(740,447)],q,VIOLET,3,True)
    elif t<65:
        u=t-60;im=bg('light').copy();center(im,640,70,'여행 일정의 맥락을 한눈에.',49,INK,q=p(u))
        shot(im,6,871,370,685,u,accent=(725,253,1120,508) if u>1 else None)
        for k in range(4):
            q=p(u,.35+k*.38,.65)
            if q<=0:continue
            yy=190+k*105;xx=66-65*(1-q)
            if k:path(im,[(xx+24,yy-29),(xx+24,yy+20)],q,'#a8bdf5',3)
            box(im,xx,yy,403,84,WHITE,16,'#dce6f7');pin(im,xx+24,yy+42,k+1,VIOLET,.7)
            text(im,xx+52,yy+15,TIMES[k],20,VIOLET,True);text(im,xx+52,yy+43,NAMES[k],20,INK,True)
        center(im,640,665,'방문 순서와 예상 방문 시각을 대화에서 확인',22,MUTED,q=p(u,.9))
    else:
        u=t-65;im=bg('violet').copy();center(im,640,94,'대화로 이어지는 일정 편집',50,WHITE,q=p(u))
        for j,(head,detail) in enumerate([('자연어 요청','원하는 일정 말하기'),('변경안 확인','바뀔 내용 살펴보기'),('일정 적용','사용자가 결정하기')]):
            q=p(u,.2+j*.22,.55)
            if q<=0:continue
            x=244+j*396;y=335+38*(1-q)
            if j:path(im,[(x-306,336),(x-90,336)],q,'#a698ef',4,True)
            circ(im,x,y,90,'#4e3b9d','#b9a7ff',2)
            if j==0:box(im,x-34,y-28,68,48,None,12,WHITE,3);line(im,[(x-15,y+20),(x-22,y+33),(x+3,y+20)],WHITE,3)
            elif j==1:
                box(im,x-32,y-34,64,68,None,7,WHITE,3)
                for k in range(3):line(im,[(x-19,y-17+k*16),(x+19,y-17+k*16)],WHITE,3)
            else:line(im,[(x-27,y+1),(x-8,y+21),(x+32,y-23)],WHITE,7)
            center(im,x,487,head,34,WHITE,q=q);center(im,x,530,detail,21,'#d0c7ff',False,q)
    return im


def closing(t):
    if t<71:
        u=t-68;im=bg('blue').copy();center(im,640,87,'여행을 설계하는 두 가지 방법',47,WHITE,q=p(u))
        for j,(head,en,col) in enumerate([('방문 순서 최적화','Visit Order Optimization',BLUE),('AI 여행 플래너','AI Travel Planner',VIOLET)]):
            q=p(u,.2+j*.23,.6);x=72+j*584;y=195+45*(1-q);box(im,x,y,552,383,WHITE,27);cx=x+276;cy=y+119
            if j==0:
                pts=[(cx-104,cy+30),(cx-29,cy-34),(cx+49,cy+24),(cx+111,cy-33)];path(im,pts,q,BLUE,5,True)
                for i,(a,b) in enumerate(pts):pin(im,a,b,i+1,BLUE,.85)
            else:circ(im,cx,cy,67,'#f0eaff');spark(im,cx,cy,43,VIOLET);spark(im,cx+83,cy-39,14,VIOLET)
            center(im,cx,y+262,head,37,INK,q=q);center(im,cx,y+314,en,20,col,False,q)
    else:
        u=t-71;im=bg('light').copy();orbit(im,640,286,u,'#d1e0fa','#80adf7',(110,180,252))
        pts=[(535,282),(610,225),(745,274)];path(im,curve(pts[0],pts[1],22)+curve(pts[1],pts[2],40)[1:],p(u,.05,.8),BLUE,6,True)
        for x,y in pts:circ(im,x,y,12,WHITE,BLUE,4)
        center(im,640,364,'Trasolve',88,INK,q=p(u,.1,.7));center(im,640,478,'가고 싶은 곳, 이어지는 여행.',43,BLUE,q=p(u,.35,.7));center(im,640,559,'trasolve.mangagaki.net',24,MUTED,q=p(u,.65,.7))
    return im


def frame(t):
    if t<16:return opening(t)
    if t<30:return product(t)
    if t<50:return optimization(t)
    if t<68:return ai(t)
    return closing(t)

@lru_cache(maxsize=18)
def previous(cut):return frame(cut-1/FPS)

def render_frame(t, frame_at=frame, previous_at=previous, cuts=CUTS):
    im=frame_at(t)
    for index,cut in enumerate(cuts[1:-1]):
        if cut<=t<cut+.33:
            q=smooth((t-cut)/.33);old=previous_at(cut)
            if index%3==0:
                shift=round(W*q);result=im.copy()
                if shift<W:result.paste(old.crop((shift,0,W,H)),(0,0))
                if shift:result.paste(im.crop((0,0,shift,H)),(W-shift,0))
                im=result
            elif index%3==1:im=Image.blend(old,im,q)
            else:
                shift=round(H*q);result=im.copy()
                if shift<H:result.paste(old.crop((0,shift,W,H)),(0,0))
                if shift:result.paste(im.crop((0,0,W,shift)),(0,H-shift))
                im=result
            break
    return im


def preview(render=render_frame, version='v8', times=None):
    if times is None:
        times=[2.8,6.8,10.9,14.7,19.8,24.7,28.6,33.7,38.7,41.3,42.5,44.5,48.5,52.7,57.5,62.7,67.2,69.8,73.4]
    sheet=Image.new('RGB',(1920,math.ceil(len(times)/4)*294),'#e0e7f1');d=ImageDraw.Draw(sheet)
    for i,t in enumerate(times):
        im=render(t);x=i%4*480;y=i//4*294
        sheet.paste(im.resize((480,270),Image.Resampling.LANCZOS),(x,y));d.text((x+8,y+275),f'{t:.1f}s',fill=INK)
    sheet.save(OUT/f'{version}_contact.jpg',quality=92)


def main(render=render_frame, version='v8', preview_times=None):
    ap=argparse.ArgumentParser();ap.add_argument('--preview',action='store_true');ap.add_argument('--output',type=Path,default=ROOT/f'Trasolve_75s_{version}.mp4');args=ap.parse_args()
    if args.preview:preview(render,version,preview_times);return
    a=audio();cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(a),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','3','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(DURATION),str(args.output)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE);start=time.monotonic()
    try:
        for i in range(FPS*DURATION):
            proc.stdin.write(render(i/FPS).tobytes())
            if i%150==0:print(f'{i}/{FPS*DURATION} frames | {time.monotonic()-start:.1f}s',flush=True)
    finally:proc.stdin.close()
    if proc.wait():raise RuntimeError('ffmpeg failed')
    print(args.output,flush=True)

if __name__=='__main__':main()
