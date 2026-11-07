"""Records reel narration, one small audio file per beat, and links them into data/reels.json.

  python3 tools/reels/voice.py --sample            one Kafka beat in the chosen voice, into ../reel-voice-samples/
  python3 tools/reels/voice.py                     record every beat that has no recording yet (run build.py first)

The default engine is Kokoro (open source, runs on this Mac, no key), voice af_heart, installed in ~/.data-architect/kokoro
(a venv with kokoro-onnx and soundfile, plus kokoro-v1.0.onnx and voices-v1.0.bin from the kokoro-onnx releases); this
script re-runs itself with that venv's Python. --engine openai uses OpenAI text-to-speech instead, with the key from
$OPENAI_API_KEY or "openai_key" in ~/.data-architect/config.json (never printed or committed).
Files go to audio/reels/<reel id>-<beat>-<hash>.m4a (AAC, mono, 32 kbit/s: about 4 KB a second of speech). The hash
covers the text, voice and style, so a changed script is recorded again and an unchanged one never is."""
import hashlib, json, os, subprocess, sys, tempfile, urllib.request

KOKORO = os.path.expanduser('~/.data-architect/kokoro')
MODEL = 'gpt-4o-mini-tts'
STYLE = ('Speak like a calm, warm senior engineer explaining one idea to a friend over coffee. '
         'Natural pace, short pauses between sentences, gentle emphasis on the key words, never salesy or robotic.')
OUT = 'audio/reels'


def key():
    k = os.environ.get('OPENAI_API_KEY')
    if not k:
        try:
            k = json.load(open(os.path.expanduser('~/.data-architect/config.json'))).get('openai_key')
        except Exception:
            k = None
    if not k:
        sys.exit('No OpenAI key: add "openai_key" to ~/.data-architect/config.json (see the reels note in CLAUDE.md).')
    return k


_kok = None
def speak_kokoro(text, voice, path, speed=1.0):
    global _kok
    import soundfile
    from kokoro_onnx import Kokoro
    _kok = _kok or Kokoro(os.path.join(KOKORO, 'kokoro-v1.0.onnx'), os.path.join(KOKORO, 'voices-v1.0.bin'))
    samples, rate = _kok.create(text, voice=voice, speed=speed, lang='en-us')
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'a.wav')
        soundfile.write(src, samples, rate)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', src, path], check=True)


def speak(text, voice, path):
    if ENGINE == 'kokoro':
        return speak_kokoro(text, voice, path)
    body = json.dumps({'model': MODEL, 'voice': voice, 'input': text, 'instructions': STYLE, 'response_format': 'mp3'}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body, headers={'Authorization': 'Bearer ' + key(), 'Content-Type': 'application/json'})
    try:
        mp3 = urllib.request.urlopen(req, timeout=120).read()
    except urllib.error.HTTPError as e:
        sys.exit('OpenAI refused the request (%s): %s' % (e.code, e.read().decode()[:300]))
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'a.mp3')
        open(src, 'wb').write(mp3)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', src, path], check=True)


def main(a):
    global ENGINE
    ENGINE = a[a.index('--engine') + 1] if '--engine' in a else 'kokoro'
    voice = a[a.index('--voice') + 1] if '--voice' in a else ('af_heart' if ENGINE == 'kokoro' else 'coral')
    if '--sample' in a:
        d = os.path.join('..', 'reel-voice-samples'); os.makedirs(d, exist_ok=True)
        text = ('First, what makes a disk slow. A hard disk has an arm that must physically move to the place where data goes. '
                'That move is a seek, about ten milliseconds. Kafka never writes in scattered places. Each new message goes at the end, '
                'right after the last one. The arm stays put, and data streams down in one run.')
        p = os.path.join(d, '%s-%s.m4a' % (ENGINE, voice)); speak(text, voice, p); print('wrote', p)
        return
    data = json.load(open('data/reels.json'))
    os.makedirs(OUT, exist_ok=True)
    n = 0  # --shard I/N records every Nth reel, so N recorders can run side by side (build.py links the files after)
    si, sn = map(int, a[a.index('--shard') + 1].split('/')) if '--shard' in a else (0, 1)
    for mid, reels in data.items():
        for ri, r in enumerate(reels):
            if ri % sn != si: continue
            for i, b in enumerate(r['beats']):
                h = hashlib.sha1((ENGINE + '|' + voice + '|' + (STYLE if ENGINE == 'openai' else '') + '|' + b['say']).encode()).hexdigest()[:10]
                p = '%s/%s-%d-%s.m4a' % (OUT, r['id'], i, h)
                if not os.path.exists(p):
                    speak(b['say'], voice, p); n += 1
                b['audio'] = p
    if sn == 1: json.dump(data, open('data/reels.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print('recorded', n, 'new beats with the', voice, 'voice')


ENGINE = 'kokoro'
if __name__ == '__main__':
    if '--engine' not in sys.argv or 'kokoro' in sys.argv:
        vpy = os.path.join(KOKORO, 'venv', 'bin', 'python')
        try:
            import kokoro_onnx  # noqa: F401
        except ImportError:
            if not os.path.exists(vpy): sys.exit('Kokoro is not installed in ' + KOKORO)
            os.execv(vpy, [vpy] + sys.argv)
    main(sys.argv[1:])
