"""Render the travel-planning question and a filmed route optimization in the v8 timeline."""
import subprocess
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

import render_v8 as v8

CAPTURE = v8.ROOT / "assets" / "route-optimization.mp4"
CAPTURE_START = 40
CAPTURE_END = 45
CUTS = [0, 4, 8.5, 15.5, 19.5, *v8.CUTS[5:]]
PREVIEW_TIMES = [2.8, 7, 10, 14.4, 18.4, 21.3, 24.7, 28.6, 33.7, 38.7,
                 40.7, 42.4, 44.6, 48.5, 52.7, 57.5, 62.7, 67.2, 69.8, 73.4]


def visit_question(elapsed):
    im = v8.bg("warm").copy()
    v8.center(im, 640, 150, "그런데 어떤 순서로 방문해야", 55, v8.INK,
              q=v8.p(elapsed))
    v8.center(im, 640, 231, "하루를 효율적으로 보낼 수 있을까요?", 56, v8.INK,
              q=v8.p(elapsed, .15))
    stops = [(270, 450, "경복궁"), (640, 400, "봉은사"), (1010, 450, "석촌호수")]
    for i, (x, y, name) in enumerate(stops):
        if i:
            last_x, last_y, _ = stops[i - 1]
            points = v8.curve((last_x + 40, last_y), (x - 40, y), 30)
            for dash in range(0, 40, 4):
                v8.path(im, points[dash:dash + 3], v8.p(elapsed, .5), "#ceaaa4", 3)
        reveal = v8.p(elapsed, .3 + i * .2)
        if reveal:
            v8.circ(im, x, y, 32 * reveal, v8.WHITE, v8.RED, 3)
            v8.center(im, x, y, "?", 29, v8.RED, q=reveal)
            v8.center(im, x, y + 76, name, 29, v8.INK, q=reveal)
    return im


@lru_cache(maxsize=1)
def directions_heading():
    labels = [("google-maps-icon.png", "구글 지도와"),
              ("naver-map-icon.png", "네이버 지도의 일반 길찾기")]
    font = v8.font(31, True)
    icon_size = v8.sc(43)
    icon_gap, group_gap = v8.sc(10), v8.sc(17)
    widths = [round(font.getlength(label)) for _, label in labels]
    width = sum(widths) + len(labels) * (icon_size + icon_gap) + group_gap
    heading = Image.new("RGBA", (width, icon_size + v8.sc(8)))
    draw = ImageDraw.Draw(heading)
    mid_y = heading.height // 2
    x = 0
    for (filename, label), label_width in zip(labels, widths):
        with Image.open(v8.ROOT / "assets" / filename) as source:
            icon = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        heading.alpha_composite(icon, (x, mid_y - icon_size // 2))
        x += icon_size + icon_gap
        draw.text((x, mid_y), label, fill="#bfd6ff", font=font, anchor="lm")
        x += label_width + group_gap
    return heading


def directions_comparison(elapsed):
    im = v8.bg("dark").copy()
    heading = directions_heading()
    reveal = v8.p(elapsed)
    x = (im.width - heading.width) // 2
    y = v8.sc(75 + 20 * (1 - reveal)) - heading.height // 2
    alpha = heading.getchannel("A")
    if reveal < 1:
        alpha = alpha.point(lambda value: round(value * reveal))
    im.paste(heading, (x, y), alpha)
    v8.center(im, 640, 161, "두 장소 사이의 길을 알려줍니다.", 56, v8.WHITE,
              q=v8.p(elapsed, .12))
    points = [(238, 384), (398, 384), (476, 306), (669, 306), (747, 384), (1034, 384)]
    v8.line(im, points, "#324b73", 13)
    v8.path(im, points, v8.p(elapsed, .35, 1.35), "#79b4ff", 6, True)
    for (x, y), letter, label in [(points[0], "A", "출발지"), (points[-1], "B", "도착지")]:
        v8.pin(im, x, y, letter, v8.BLUE, 1.15)
        v8.center(im, x, y + 58, label, 22, "#dce8ff")
    reveal = v8.p(elapsed, 2.0, .5)
    v8.center(im, 640, 548, "하지만 영업시간까지 고려한 하루의 방문 순서는", 35,
              "#e8d5ce", q=reveal)
    v8.center(im, 640, 610, "여행자가 직접 정해야 합니다.", 49,
              v8.WHITE, q=v8.p(elapsed, 2.2, .5))
    return im


def create_renderer(capture_dir):
    def frame(t):
        if t < 4:
            return v8.opening(t, first_line="여행에서 가고 싶은 곳을")
        if t < 8.5:
            return visit_question(t - 4)
        if t < 15.5:
            return directions_comparison(t - 8.5)
        if t < 19.5:
            return v8.opening(12 + t - 15.5,
                              conditions_title="그래서 Trasolve는 방문 순서까지 짜줍니다.",
                              conditions_summary="영업시간과 체류시간, 장소 사이의 이동시간을 고려합니다.")
        if t < 22:
            # Rejoin the existing brand reveal at its fully legible title.
            return v8.product(19 + t - 19.5)
        if CAPTURE_START <= t < CAPTURE_END:
            last_index = (CAPTURE_END - CAPTURE_START) * v8.FPS - 1
            index = min(last_index, round((t - CAPTURE_START) * v8.FPS))
            with Image.open(capture_dir / f"{index:03d}.jpg") as still:
                return still.convert("RGB")
        return v8.frame(t)

    @lru_cache(maxsize=len(CUTS))
    def previous(cut):
        return frame(cut - 1 / v8.FPS)

    return lambda t: v8.render_frame(t, frame, previous, CUTS)


if __name__ == "__main__":
    with TemporaryDirectory(prefix="trasolve-promo-") as directory:
        capture_dir = Path(directory)
        subprocess.run([
            "ffmpeg", "-v", "error", "-i", str(CAPTURE), "-an", "-q:v", "2",
            "-start_number", "0", str(capture_dir / "%03d.jpg"),
        ], check=True)
        v8.main(create_renderer(capture_dir), "v9", PREVIEW_TIMES)
