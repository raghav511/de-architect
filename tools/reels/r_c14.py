# c14: Claude in data pipelines. Four-level series on the core section, C14.3 prompt caching and the cost example.
MID = 'c14'
REELS = [
 {'sec': 'C14.3', 'level': 'New to it', 'title': 'Prompt caching: the photocopied cover sheet',
  'beats': [
   {'say': 'Picture sending a million letters. Each one starts with the same two-page cover sheet of rules, then one short line that changes. Would you retype the cover sheet a million times?',
    'show': {'t': 'big', 'text': 'Retype the same 2 pages, *a million times*?', 'sub': 'or photocopy them once'}},
   {'say': 'Of course not. You make it once and copy it. Prompt caching does that for Claude. The long, identical start of every request is processed once and then reused, at a small fraction of the normal price.',
    'show': {'t': 'flow', 'items': ['Same rules and examples', 'Processed once', 'Reused for every ticket']}},
   {'say': 'There is one catch. The reused part must be exactly the same every time. Change one word at the top, and it is a new cover sheet.',
    'show': {'t': 'big', 'text': 'Identical start, or *no copy*', 'sub': 'change one word and it starts again'}}],
  'check': {'q': 'What does prompt caching reuse?', 'opts': ['The answers to earlier questions', 'The identical start of the prompt, processed once', 'The changing part at the end of each request'], 'ans': 1, 'why': 'It stores the processed prefix; the changing part is still read normally.'},
  'work': ['Find a prompt you send many times with the same long start', 'Move everything that changes to the end']},
 {'sec': 'C14.3', 'level': 'How it works', 'title': 'Marking the cache and proving it works',
  'beats': [
   {'say': 'Put the stable part first: tools, then the system prompt with your rules and examples. Mark its end with cache control. The ticket goes after it, in the user message.',
    'show': {'t': 'flow', 'items': ['Tools', 'System: rules + examples', 'cache_control marker', 'User: one ticket']}},
   {'say': 'The first request writes the cache, at a little more than normal input. The ones after it, within five minutes, read it at about a tenth of the price. Each hit keeps the entry alive.',
    'show': {'t': 'bars', 'items': [['No cache', 100, ''], ['First request: write', 125, ''], ['Later requests: read', 10, 'about a tenth']], 'unit': '% of input price'}},
   {'say': 'Never trust it, check it. The usage in each response has cache read input tokens. If it stays at zero, something at the top of your prompt is changing.',
    'show': {'t': 'big', 'text': 'cache_read_input_tokens > *0*', 'sub': 'zero means the prefix changes'}}],
  'check': {'q': 'cache_read_input_tokens stays at 0 on repeated requests. What is the likely cause?', 'opts': ['Something before the cache marker changes on each request', 'The output schema is too strict', 'The tickets are too short'], 'ans': 0, 'why': 'Only an identical prefix is read from the cache.'},
  'work': ['Print cache_read_input_tokens for your first three calls', 'Remove timestamps and ids from the cached part']},
 {'sec': 'C14.3', 'level': 'Inside and caveats', 'title': 'What the cache stores, and what breaks it',
  'beats': [
   {'say': 'Before Claude can read the next token, it turns every earlier token into internal state. Caching stores that state for an identical prefix, so a million requests do that work once.',
    'show': {'t': 'big', 'text': 'Stored: the work on the *prefix*', 'sub': 'not the answer'}},
   {'say': 'So the rules are strict. A changed byte early on changes everything after it. Prefixes below about five hundred tokens are not cached at all. Entries last five minutes, or an hour if you pay double to write.',
    'show': {'t': 'points', 'items': ['One changed byte: a miss', 'Too short: no cache', '5 minutes, or 1 hour', 'One cache per model']}},
   {'say': 'And caches belong to one model. Switch models in the middle of a job, and you start cold again.',
    'show': {'t': 'big', 'text': 'New model, *cold cache*', 'sub': 'keep one model per job'}}],
  'check': {'q': 'Why does a timestamp at the top of the system prompt ruin caching?', 'opts': ['Timestamps are not allowed in prompts', 'It changes the prefix, so everything after it is a new prefix', 'It makes the output longer'], 'ans': 1, 'why': 'The cache matches from the start; any change early on breaks the match.'},
  'work': ['List everything above your cache marker and check none of it changes per request']},
 {'sec': 'C14.3', 'level': 'Architect', 'title': 'Twenty times, then four times: the cost story',
  'beats': [
   {'say': 'A million tickets a night, a two thousand token prefix, a short ticket and a short answer. On Sonnet with no cache, about four thousand six hundred dollars a night. On Haiku, about two hundred and thirty.',
    'show': {'t': 'bars', 'items': [['Sonnet, no cache', 4600, ''], ['Haiku, no cache', 230, ''], ['Haiku, cached', 50, 'about 4x less again']], 'unit': '$ a night'}},
   {'say': 'Cache the prefix and Haiku falls to about fifty. The model choice was worth twenty times; caching another four. Batch it, since nobody waits, and the price halves again.',
    'show': {'t': 'points', 'items': ['Model: about 20x', 'Caching: about 4x', 'Batch: another 2x']}},
   {'say': 'In a design review, lead with the arithmetic, then say how you check quality: a labelled sample, scored before and after every change.',
    'show': {'t': 'big', 'text': 'Arithmetic first, *then* quality checks', 'sub': 'the cheapest row is the right one'}}],
  'check': {'q': 'In the example, which change saved the most money?', 'opts': ['Prompt caching', 'Choosing the smaller model that passes the evals', 'Shorter tickets'], 'ans': 1, 'why': 'Sonnet to Haiku was about 20 times; caching about 4 times more.'},
  'work': ['Work out tokens per request and cost per million rows for your own LLM step', 'Score the cheaper option on a labelled sample before switching']},
]
