# c13: Prompting Claude in depth. Four-level series on the core section, C13.1 the anatomy of a prompt.
MID = 'c13'
REELS = [
 {'sec': 'C13.1', 'level': 'New to it', 'title': 'A prompt is a note to a new colleague',
  'beats': [
   {'say': 'Imagine leaving a note for a new colleague who starts tomorrow. You will be asleep, so they cannot ask you anything. Would you write just: look at the failed job?',
    'show': {'t': 'big', 'text': '"Look at the failed job."', 'sub': 'and you are not there to explain'}},
   {'say': 'They would guess which job, guess what you want back, and maybe restart it, which might make things worse. A good note says who it is for, what you know, the one thing to do, and how to answer.',
    'show': {'t': 'points', 'items': ['Who it is for', 'What you know, and why', 'The one thing to do', 'How to answer']}},
   {'say': 'A prompt that runs inside a pipeline is exactly that note. Nobody is awake to clarify. Every gap you leave, Claude fills with a guess.',
    'show': {'t': 'big', 'text': 'Every gap becomes a *guess*', 'sub': 'write the note you would want'}}],
  'check': {'q': 'Why does a prompt in a nightly pipeline need more detail than a chat message?', 'opts': ['Nobody is there to answer its questions, so gaps become guesses', 'Pipelines run on a model that reads less', 'Long prompts are always cheaper'], 'ans': 0, 'why': 'In a chat you can clarify; in a pipeline the prompt is all Claude gets.'},
  'work': ['Read your pipeline prompt as a new colleague would: list every question they would ask', 'Answer each question in the prompt itself']},
 {'sec': 'C13.1', 'level': 'How it works', 'title': 'Five parts of a pipeline prompt',
  'beats': [
   {'say': 'A prompt that runs without you has five parts. The role says who is speaking and for whom. The context gives facts Claude cannot know, with the reason they matter.',
    'show': {'t': 'flow', 'items': ['Role', 'Context + why', 'Task', 'Constraints', 'Output format']}},
   {'say': 'The task is one outcome, not three. Constraints cover the edges, such as: quote the log line, and say unknown if no line proves the cause. The output format is the exact shape, often a JSON schema.',
    'show': {'t': 'points', 'items': ['One task, one outcome', 'Quote the proof', 'Unknown is allowed', 'A schema for the answer']}},
   {'say': 'The stable parts go in the system prompt. The changing input, like tonight\'s log, goes in the user message. That keeps instructions apart from data.',
    'show': {'t': 'flow', 'items': ['System prompt: stable rules', 'User message: tonight\'s log', 'Answer in the schema']}}],
  'check': {'q': 'Where does tonight\'s failure log belong?', 'opts': ['In the system prompt, before the role', 'In the user message, apart from the stable instructions', 'Inside the output schema as a default value'], 'ans': 1, 'why': 'Stable rules in the system prompt, changing input in the user message.'},
  'work': ['Split one of your prompts into the five parts and move the changing input to the user message']},
 {'sec': 'C13.1', 'level': 'Inside and caveats', 'title': 'Why the reason beats the rule',
  'beats': [
   {'say': 'Current Claude models follow instructions closely and literally. Ask for a review and you get a review, not a verdict. If you want a verdict, ask for one.',
    'show': {'t': 'big', 'text': 'Literal in, *literal* out', 'sub': 'ask for exactly what you want'}},
   {'say': 'Giving the reason matters too. "No emails in the summary" covers emails. "No personal data, because this is posted to a public channel" also covers names and phone numbers. The reason becomes a rule Claude can apply to cases you never listed.',
    'show': {'t': 'points', 'items': ['Rule: no emails', 'Reason: posted publicly', 'So: no names, no phones either']}},
   {'say': 'And skip the shouting. Capitals and the word critical, written for older models, make current ones over-apply the rule. Say it once, calmly, with its reason.',
    'show': {'t': 'big', 'text': 'Once, calmly, *with the reason*', 'sub': 'not CRITICAL in capitals'}}],
  'check': {'q': 'Why add "because it is posted to a public channel" to a privacy rule?', 'opts': ['It makes the prompt shorter', 'Claude can apply the reason to cases the rule did not list', 'It turns the rule into a hard permission'], 'ans': 1, 'why': 'A reason generalises; a bare rule covers only what it names. It is still not a hard control.'},
  'work': ['Add the reason to every rule in one prompt', 'Remove capitals and CRITICAL from old prompts']},
 {'sec': 'C13.1', 'level': 'Architect', 'title': 'Prompts are code, rules are controls',
  'beats': [
   {'say': 'At scale, treat a prompt like code. It lives in git with a version, it has a test set, and every output row records the prompt version and the pinned model, so you can backfill on purpose.',
    'show': {'t': 'points', 'items': ['In git, versioned', 'A test set on every change', 'Prompt and model on every row']}},
   {'say': 'But a prompt is never a control. Anything that must always hold, like no writes or no personal data leaving, belongs in code, permissions and schemas. The prompt asks; the system enforces.',
    'show': {'t': 'flow', 'items': ['Prompt: asks nicely', 'Schema: limits the shape', 'Code: checks the rules', 'Permissions: limit the actions']}},
   {'say': 'In a design review, say both halves: how you wrote the prompt, and what still holds when the prompt is ignored.',
    'show': {'t': 'big', 'text': 'What holds when the prompt is *ignored*?', 'sub': 'the question that ends the review'}}],
  'check': {'q': 'A rule must hold even if the model ignores the prompt. Where does it belong?', 'opts': ['In capitals at the top of the system prompt', 'In code, schemas and permissions around the model', 'In the few-shot examples'], 'ans': 1, 'why': 'Prompts guide behaviour; enforcement lives outside the model.'},
  'work': ['For each rule in your pipeline prompt, name the code or permission that enforces it', 'Store prompt version and model on every output row']},
]
