# Turns the layout from measure.mjs into the logo as an SVG: the letters
# become outlines of the font (Alfa Slab One, SIL Open Font License 1.1), so
# the game ships no font file. Colors and shapes as on the design board.
# Needs Python 3 with fontTools (pip install fonttools).
# Usage: python3 tools/logo/outline.py <AlfaSlabOne-Regular.ttf> layout.json > themes/kaffeeroesterei/logo.svg
import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

font_path, layout_path = sys.argv[1:3]
layout = json.load(open(layout_path))
font = TTFont(font_path)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
units = font['head'].unitsPerEm
em = layout['em']


def num(value):
    text = f'{value:.2f}'.rstrip('0').rstrip('.')
    return '0' if text in ('', '-0') else text


def outlines(line):
    scale = line['fontSize'] / units
    path = []
    for letter in line['letters']:
        if letter['letter'] == ' ':
            continue
        pen = SVGPathPen(glyphs, ntos=num)
        glyphs[cmap[ord(letter['letter'])]].draw(TransformPen(pen, (scale, 0, 0, -scale, letter['x'], line['baseline'])))
        path.append(pen.getCommands())
    return ''.join(path)


width, height = layout['width'], layout['height']
radius = 0.26 * em
# The outline of the label: 0.04 em wide, 0.13 em inside the edge.
inset = 0.11 * em
emblem, chevrons = layout['emblem'], layout['chevrons']
chevron_scale = min(chevrons['w'] / 60, chevrons['h'] / 24)
chevron_x = chevrons['x'] + (chevrons['w'] - 60 * chevron_scale) / 2
chevron_y = chevrons['y'] + (chevrons['h'] - 24 * chevron_scale) / 2
line1, line2 = layout['lines']

print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(width)} {num(height)}">
<!-- Full Roast Ahead, logo A ("Roestetikett") from the design board. The lettering is
     the font Alfa Slab One by JM Sole (SIL Open Font License 1.1), converted to outlines,
     so the game ships no font file. -->
<rect width="{num(width)}" height="{num(height)}" rx="{num(radius)}" fill="#2a1e17"/>
<rect x="{num(inset)}" y="{num(inset)}" width="{num(width - 2 * inset)}" height="{num(height - 2 * inset)}" rx="{num(radius - inset)}" fill="none" stroke="#f2c14e" stroke-width="{num(0.04 * em)}"/>
<g transform="translate({num(emblem['x'])} {num(emblem['y'])}) scale({num(emblem['w'] / 48)})"><circle cx="24" cy="24" r="23" fill="#f2c14e"/><circle cx="24" cy="24" r="19.5" fill="none" stroke="#2a1e17" stroke-width="1.6"/><g transform="rotate(-28 24 24)"><ellipse cx="24" cy="24" rx="9.5" ry="13.5" fill="#2a1e17"/><path d="M24 11.5Q19 24 24 36.5" stroke="#f2c14e" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></g>
<path fill="#f8eddf" d="{outlines(line1)}"/>
<path fill="#f2c14e" d="{outlines(line2)}"/>
<g transform="translate({num(chevron_x)} {num(chevron_y)}) scale({num(chevron_scale)})" fill="none" stroke="#f2c14e" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4L14 12L4 20"/><path d="M22 4L32 12L22 20"/><path d="M40 4L50 12L40 20"/></g>
</svg>''')
