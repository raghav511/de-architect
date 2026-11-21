# c15: Apps, decks and documents with Claude. Four-level series on the core section, C15.1 artifacts: brief, steer, check.
MID = 'c15'
REELS = [
 {'sec': 'C15.1', 'level': 'New to it', 'title': 'Briefing Claude like a designer',
  'beats': [
   {'say': 'Ask a designer for a poster with no details and you get a guess. Tell them who will read it, the one message, and the space it must fit, and the first draft is close.',
    'show': {'t': 'big', 'text': 'No brief, *a guess*', 'sub': 'a good brief, a close first draft'}},
   {'say': 'Asking Claude for a page, a dashboard or a deck works the same way. Four lines do most of the work: who reads it and what they decide, the data, the one message, and the shape.',
    'show': {'t': 'points', 'items': ['Who reads it, and the decision', 'The data to compute from', 'The one message', 'The shape: numbers, chart, table']}},
   {'say': 'The thing Claude makes is called an artifact. It opens beside the chat, starts private to you, and changes as you talk to it.',
    'show': {'t': 'big', 'text': 'An *artifact*', 'sub': 'beside the chat, private until you share'}}],
  'check': {'q': 'Which line belongs in a good artifact brief?', 'opts': ['Make it look modern', 'Who reads it and what they will decide', 'Use lots of colours'], 'ans': 1, 'why': 'The reader and their decision shape everything else.'},
  'work': ['Write a four-line brief before you ask for any page or deck']},
 {'sec': 'C15.1', 'level': 'How it works', 'title': 'Feedback that lands',
  'beats': [
   {'say': 'The first draft arrives in a minute and looks finished. Now steer it. Make it nicer gets a random redesign. Say what, where and why.',
    'show': {'t': 'big', 'text': '"Make it nicer" = *random*', 'sub': 'say what, where and why'}},
   {'say': 'Move the detection chart above the table, because it carries the message. Colour only the users bar. Label the axis in minutes, starting at zero. One change per message, so you can see what each one did.',
    'show': {'t': 'flow', 'items': ['Draft', 'One specific change', 'Look', 'Next change']}},
   {'say': 'In a document, highlight the passage and choose Edit with Claude, so you never have to describe where it is.',
    'show': {'t': 'big', 'text': 'Highlight, then *Edit with Claude*', 'sub': 'no need to say where'}}],
  'check': {'q': 'Why give one change per message?', 'opts': ['Claude can only read short messages', 'You can see what each change did, and none get missed', 'It costs nothing'], 'ans': 1, 'why': 'Ten changes at once means some are missed and you cannot tell which.'},
  'work': ['Give your next three rounds of feedback as one change each, with a reason']},
 {'sec': 'C15.1', 'level': 'Inside and caveats', 'title': 'Plausible numbers are the trap',
  'beats': [
   {'say': 'An artifact is code or a document that Claude writes and the app renders. Ask for a dashboard, and it will draw bars, whether or not it computed them from your file.',
    'show': {'t': 'big', 'text': 'Bars are easy. *Right* bars are work.', 'sub': 'drawn is not computed'}},
   {'say': 'So attach the data and ask it to compute every number from the file, with the calculation shown beside each figure. Then count two numbers yourself.',
    'show': {'t': 'points', 'items': ['Attach the data', 'Compute from the file', 'Show the calculation', 'Recount two numbers']}},
   {'say': 'Each round also regenerates parts of the page, so an unrequested change can slip in. Compare versions before you share, like reviewing a diff.',
    'show': {'t': 'big', 'text': 'Review it like a *diff*', 'sub': 'before anyone else sees it'}}],
  'check': {'q': 'The page says 8 incidents were found by users; your count says 6. What do you do?', 'opts': ['Trust the page', 'Point to that number, ask for its calculation and fix it', 'Delete the number'], 'ans': 1, 'why': 'Name the specific figure and make the calculation visible.'},
  'work': ['Recount two headline numbers from the source before sharing any AI-made page']},
 {'sec': 'C15.1', 'level': 'Architect', 'title': 'From one-off page to a maintained report',
  'beats': [
   {'say': 'A one-off page for tomorrow\'s meeting is fine as an artifact. But if leaders will read it every month, it needs an owner, a source query in version control, and the same calculation each time.',
    'show': {'t': 'flow', 'items': ['One-off: an artifact', 'Monthly: a query in git', 'Owned: a named owner']}},
   {'say': 'Decide sharing on purpose. Artifacts start private. Share with the reader for comments first, and keep customer data out: aggregates or a masked sample only.',
    'show': {'t': 'points', 'items': ['Private first', 'Reader comments, then wider', 'Aggregates, never raw customer rows']}},
   {'say': 'In a review, say how fast you made it, and how you know the numbers are right.',
    'show': {'t': 'big', 'text': 'Fast, *and* checked', 'sub': 'both halves of the story'}}],
  'check': {'q': 'A dashboard artifact will be read every month by leadership. What should change?', 'opts': ['Nothing, regenerate it each month', 'A named owner and the source query kept in version control', 'Make it public so everyone can see it'], 'ans': 1, 'why': 'A recurring report needs the same calculation every time and someone who owns it.'},
  'work': ['For any report you repeat, store its query next to it and name its owner']},
]
