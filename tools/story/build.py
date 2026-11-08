"""Build data/story.json, the Meridian series, from tools/story/s1.json … s5.json and the cast below.
   python3 tools/story/build.py      (bible: tools/story/BIBLE.md; checks every main module has a full arc)"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
CAST = [
  {'name': 'Marcus Bell', 'role': 'Meridian\'s first staff data architect, the lead. Careful, curious, a little too willing to fix things himself.'},
  {'name': 'Asha Menon', 'role': 'CTO. Direct, high bar, fair: "Show me the number, then the plan."'},
  {'name': 'Dev Okafor', 'role': 'Data platform lead and on-call veteran. Sceptical of new tools until they earn it.'},
  {'name': 'Lena Park', 'role': 'Junior data engineer Marcus mentors. Quiet at first; leads on-call by season 4.'},
  {'name': 'Mei Tan', 'role': 'FinOps lead. Reads every cloud bill line by line: "Who pays for this?"'},
  {'name': 'Tomas Ruiz', 'role': 'Head of Product. Wants everything real time, yesterday.'},
  {'name': 'Kofi Mensah', 'role': 'Analytics lead and owner of the executive dashboard; rival, then partner.'},
  {'name': 'Grace Adeyemi', 'role': 'Retired principal engineer and Marcus\'s mentor; Friday coffees, one sentence of advice.'},
  {'name': 'Viktor Hale', 'role': 'Lead architect at Brightcart, the company Meridian buys in season 4; rival, then ally.'},
  {'name': 'Nadia and Zoe Bell', 'role': 'Marcus\'s wife, an ICU nurse on night shifts, and their daughter, 7, who asks what he built today.'}]
LOGLINE = 'Marcus Bell joins Meridian, a rides, food and payments company in 14 cities, as its first staff data architect. Each day of your plan is an episode of his first two years: you answer the questions he faces.'

def words(s): return len(re.findall(r'\S+', s))
def main():
    seasons = [json.load(open(os.path.join(HERE, 's%d.json' % n))) for n in range(1, 6) if os.path.exists(os.path.join(HERE, 's%d.json' % n))]
    plan = open(os.path.join(ROOT, 'js', 'plan.js')).read()
    mods = re.findall(r"'([a-z]\d\d)'", re.search(r'const BASE_MODS = \[([^\]]*)\]', plan).group(1))
    have = [a['mid'] for s in seasons for a in s['modules']]
    errs = ['no arc for module ' + m for m in mods if m not in have] + ['arc for unknown module ' + m for m in have if m not in mods]
    for s in seasons:
        for a in s['modules']:
            for k in ('ep', 'logline', 'boss', 'finale', 'zoe'):
                if not a.get(k): errs.append(a['mid'] + ': ' + k + ' missing')
            if len(a.get('scenes', [])) != 6 or len(a.get('teasers', [])) != 6: errs.append(a['mid'] + ': needs 6 scenes and 6 teasers')
            if any(not 15 <= words(x) <= 55 for x in a.get('scenes', [])): errs.append(a['mid'] + ': a scene is not 25 to 45 words')
            if '—' in json.dumps(a, ensure_ascii=False): errs.append(a['mid'] + ': em dash')
    if errs: print('\n'.join(errs)); sys.exit(1)
    out = {'logline': LOGLINE, 'cast': CAST, 'seasons': seasons}
    json.dump(out, open(os.path.join(ROOT, 'data', 'story.json'), 'w'), ensure_ascii=False, indent=1)
    print('data/story.json: %d seasons, %d arcs' % (len(seasons), len(have)))

if __name__ == '__main__': main()
