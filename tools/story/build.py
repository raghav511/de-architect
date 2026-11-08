"""Build data/story.json, the Meridian series, from tools/story/s1.json … s5.json and the cast below.
   python3 tools/story/build.py      (bible: tools/story/BIBLE.md; checks every main module has a full arc, and every scene links to real practice)"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
CAST = [
  {'name': 'Marcus Bell', 'pronouns': 'he', 'role': 'Meridian\'s first staff data architect, the lead. Careful, curious, a little too willing to fix things himself.'},
  {'name': 'Asha Iyer', 'pronouns': 'she', 'role': 'CTO. Direct, high bar, fair: "Show me the number, then the plan."'},
  {'name': 'Dev Malhotra', 'pronouns': 'he', 'role': 'Data platform lead and on-call veteran. Sceptical of new tools until they earn it.'},
  {'name': 'Lena Park', 'pronouns': 'she', 'role': 'Junior data engineer Marcus mentors. Quiet at first; leads on-call by season 4.'},
  {'name': 'Mei Chen', 'pronouns': 'she', 'role': 'FinOps lead. Reads every cloud bill line by line: "Who pays for this?"'},
  {'name': 'Tom Reyes', 'pronouns': 'he', 'role': 'Head of Product. Wants everything real time, yesterday.'},
  {'name': 'Kofi Mensah', 'pronouns': 'he', 'role': 'Analytics lead and owner of the executive dashboard; rival, then partner.'},
  {'name': 'Grace Okafor', 'pronouns': 'she', 'role': 'Retired principal engineer and Marcus\'s mentor; Friday coffees, one sentence of advice.'},
  {'name': 'Victor Hale', 'pronouns': 'he', 'role': 'Lead architect at Lumen, the company Meridian buys in season 4; rival, then ally.'},
  {'name': 'Nadia and Zoe Bell', 'pronouns': 'she, she', 'role': 'Marcus\'s wife, an ICU nurse on night shifts, and their daughter, 7, who asks what he built today.'}]
LOGLINE = 'Marcus Bell joins Meridian, a rides, food and payments company in 14 cities, as its first staff data architect. Each day of your plan is an episode of his first two years: you answer the questions he faces.'

REMATCH = 'A weak weekend review is never a loss: it opens a rematch on the same arc next Sunday.'

def words(s): return len(re.findall(r'\S+', s))

def link_checker():
    """A scene's `to` must open real practice: the module's own chapter, lab, practice, quiz, interview set or design
    problem, an exercise in the banks, an F7 step the module has, a simulator challenge, or the written mock."""
    bank = set()
    for k in ('py', 'sql', 'spark'):
        bank |= {k + ':' + x['id'] for x in json.load(open(os.path.join(ROOT, 'data', 'bank', k + '.json')))}
    sims = set(re.findall(r"\{ id: '(\w+)', mid: '", open(os.path.join(ROOT, 'js', 'sim.js')).read()))
    design = json.load(open(os.path.join(ROOT, 'data', 'design.json')))
    def steps(m):
        b = re.search(r'^@@steps\n(.*?)(?=^@@[a-z]+\s*$)', open(os.path.join(ROOT, 'data', 'program', m + '.txt')).read(), re.S | re.M)
        return set(re.findall(r'^STEP: (\w+)', b.group(1), re.M)) if b else set()
    def ok(m, h):
        p = h.split('/')
        if h == '#/mock': return True
        if len(p) < 3 or p[0] != '#': return False
        if p[1] == 'learn': return len(p) == 4 and p[2] == m and p[3] in ('chapter', 'lab', 'practice')
        if p[1] in ('py', 'sql', 'spark'): return p[1] + ':' + p[2] in bank
        if p[1] == 'step': return len(p) == 4 and p[2] == m and p[3] in steps(m)
        if p[1] == 'sim': return len(p) == 4 and p[2] == 'sc' and p[3] in sims
        if p[1] in ('quiz', 'interview'): return p[2] == m
        if p[1] == 'design': return p[2] == m and m in design
        return False
    return ok
def main():
    seasons = [json.load(open(os.path.join(HERE, 's%d.json' % n))) for n in range(1, 6) if os.path.exists(os.path.join(HERE, 's%d.json' % n))]
    plan = open(os.path.join(ROOT, 'js', 'plan.js')).read()
    mods = re.findall(r"'([a-z]\d\d)'", re.search(r'const BASE_MODS = \[([^\]]*)\]', plan).group(1))
    have = [a['mid'] for s in seasons for a in s['modules']]
    errs = ['no arc for module ' + m for m in mods if m not in have] + ['arc for unknown module ' + m for m in have if m not in mods]
    link_ok = link_checker()
    for s in seasons:
        for a in s['modules']:
            for k in ('ep', 'logline', 'boss', 'finale', 'zoe'):
                if not a.get(k): errs.append(a['mid'] + ': ' + k + ' missing')
            if len(a.get('scenes', [])) != 6 or len(a.get('teasers', [])) != 6: errs.append(a['mid'] + ': needs 6 scenes and 6 teasers')
            if any(not 25 <= words(x) <= 45 for x in a.get('scenes', [])): errs.append(a['mid'] + ': a scene is not 25 to 45 words')
            if any(not 8 <= words(x) <= 20 for x in a.get('teasers', [])): errs.append(a['mid'] + ': a teaser is not 8 to 20 words')
            if any(a.get(k) and not 20 <= words(a[k]) <= 45 for k in ('boss', 'finale')): errs.append(a['mid'] + ': boss or finale is not 20 to 45 words')
            if '—' in json.dumps(a, ensure_ascii=False): errs.append(a['mid'] + ': em dash')
            # every hook ends in practice; a teaser is tomorrow's question; recall opens the next morning (ENGAGE 1 and 3)
            if len(a.get('to', [])) != 6: errs.append(a['mid'] + ': needs 6 links in to, one per scene')
            errs += [a['mid'] + ': scene %d links to %s, which opens no real practice' % (i, h) for i, h in enumerate(a.get('to', [])) if not link_ok(a['mid'], h)]
            if any(not x.rstrip().endswith('?') or 'Tomorrow on Meridian' in x for x in a.get('teasers', [])): errs.append(a['mid'] + ': a teaser is not a question, or repeats the card heading')
            if len(a.get('recall', [])) != 6 or any(not x.startswith('Recall: ') or not x.endswith('?') or words(x) > 26 for x in a['recall']): errs.append(a['mid'] + ': needs 6 recall questions ("Recall: …?", at most 26 words)')
    if errs: print('\n'.join(errs)); sys.exit(1)
    out = {'logline': LOGLINE, 'cast': CAST, 'rematch': REMATCH, 'seasons': seasons}
    dest = os.path.join(ROOT, 'data', 'story.json')
    if '--check' in sys.argv:
        cur = json.load(open(dest)) if os.path.exists(dest) else None
        if cur != out: print('data/story.json is stale: run python3 tools/story/build.py'); sys.exit(1)
        print('data/story.json is current'); return
    json.dump(out, open(dest, 'w'), ensure_ascii=False, indent=1)
    print('data/story.json: %d seasons, %d arcs' % (len(seasons), len(have)))

if __name__ == '__main__': main()
