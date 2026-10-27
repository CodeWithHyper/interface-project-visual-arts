"""Validate static pages; provide parsed DOM fixtures for interaction checks."""
from html.parser import HTMLParser
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html', 'explore.html', 'memes.html', 'nft-gallery.html', 'about.html', 'contact.html']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Parser(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': '#document', 'attrs': {}, 'children': []}
        self.stack = [self.root]
        self.errors = []
        self.feed(text)
        if len(self.stack) != 1:
            self.errors.append('Unclosed tags: ' + str([node['tag'] for node in self.stack[1:]]))

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        if len(self.stack) > 1 and self.stack[-1]['tag'] == tag:
            self.stack.pop()
        else:
            self.errors.append('Unexpected closing tag: ' + tag)

    def handle_data(self, text):
        self.stack[-1]['children'].append(text)


def elements(node):
    for child in node.get('children', []):
        if isinstance(child, dict):
            yield child
            yield from elements(child)


if '--parse-stdin' in sys.argv:
    print(json.dumps(Parser(sys.stdin.read()).root))
    sys.exit()

fixtures = {name: Parser((ROOT / name).read_text()) for name in PAGES}
if '--fixtures' in sys.argv:
    print(json.dumps({name: parser.root for name, parser in fixtures.items()}))
    sys.exit()

for name, parser in fixtures.items():
    assert not parser.errors, (name, parser.errors)
    assert (ROOT / name).read_text().lower().startswith('<!doctype html>'), name
    tags = list(elements(parser.root))
    ids = [tag['attrs']['id'] for tag in tags if 'id' in tag['attrs']]
    assert len(ids) == len(set(ids)), (name, 'Duplicate IDs')
    assert len([tag for tag in tags if tag['tag'] == 'main']) == 1
    assert len([tag for tag in tags if tag['tag'] == 'h1']) == 1
    active = [tag for tag in tags if tag['attrs'].get('aria-current') == 'page']
    assert len(active) == 2 and all(tag['attrs']['href'] == name for tag in active), name
    scripts = [tag['attrs'] for tag in tags if tag['tag'] == 'script']
    assert [tag['src'] for tag in scripts] == ['site-config.js', 'data.js', 'script.js']
    assert all('defer' in tag for tag in scripts)
    for tag in tags:
        attrs = tag['attrs']
        assert 'style' not in attrs and tag['tag'] != 'style', (name, 'Inline CSS')
        assert not any(key.startswith('on') for key in attrs), (name, 'Inline event handler')
        for key in ['href', 'src']:
            link = attrs.get(key, '')
            if not link or '://' in link or link.startswith('mailto:'):
                continue
            file, _, anchor = link.partition('#')
            file = file.split('?')[0]
            target = ROOT / file if file else ROOT / name
            assert target.is_file(), (name, link)
            if anchor:
                dest = fixtures.get(file or name)
                assert dest and any(node['attrs'].get('id') == anchor for node in elements(dest.root)), (name, link)
        if tag['tag'] == 'nav':
            destinations = {node['attrs'].get('href') for node in elements(tag) if node['tag'] == 'a'}
            assert destinations == set(PAGES), (name, 'Incomplete navigation')
    assert any(tag['attrs'].get('class') == 'skip-link' for tag in tags)
    assert 'Pixel Commons' not in (ROOT / name).read_text()
print('PASS: six pages, valid nesting, navigation, active links, assets, anchors, accessibility landmarks, and HTML/CSS/JS separation')
