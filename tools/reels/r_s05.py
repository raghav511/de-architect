# Module 5: real time. Reels for section 5.2 (Kafka from the inside).
MID = 's05'
REELS = [
 {'sec': '5.2', 'title': 'Kafka writes to disk. Why is it fast?', 'part': '1 of 2', 'beats': [
   {'say': 'Kafka saves every message to disk, and disks are supposed to be slow. Yet one broker takes in hundreds of megabytes a second. How?',
    'show': {'t': 'big', 'text': 'Disk = slow?', 'sub': 'Kafka: hundreds of MB/s per broker'}},
   {'say': 'First, what makes a disk slow. A hard disk has an arm that must physically move to the place where data goes. That move is a seek, about ten milliseconds. Writes scattered all over the disk spend their time moving the arm, not writing.',
    'show': {'t': 'disk', 'mode': 'random'}},
   {'say': 'Kafka never writes in scattered places. A partition is one file, and each new message goes at the end, right after the last one. The arm stays put and data streams down in one run: over a hundred megabytes a second instead of under one.',
    'show': {'t': 'bars', 'unit': 'MB/s', 'items': [['Scattered small writes', 1, 'arm moves every time'], ['Appending to the end', 150, 'arm stays put']]}}],
  'check': {'q': 'Why does appending to the end of a log make Kafka\'s disk writes fast?', 'opts': ['The disk does not have to move to a new place between writes', 'Kafka finds each message with an index', 'Kafka keeps nothing on disk'], 'ans': 0,
            'why': 'No seek between writes: the data goes down in one continuous run. It is about not moving, not about searching. SSDs have no arm, but they also prefer large sequential writes.'},
  'work': ['Size Kafka disks for sequential bandwidth (MB/s), not random operations per second', 'Keep other busy random-write workloads off the brokers\' log disks', 'Prefer fewer, larger partitions per disk over thousands of tiny ones']},
 {'sec': '5.2', 'title': 'Kafka is fast: page cache, zero-copy, batching', 'part': '2 of 2', 'beats': [
   {'say': 'Second trick: Kafka does not keep its own cache. It writes into the page cache, the part of memory where the operating system keeps recent file data. Consumers that keep up read new messages straight from that memory, so most reads never touch the disk.',
    'show': {'t': 'flow', 'items': ['Producer', 'Page cache (RAM)', 'Consumer reads from RAM', 'Disk, written in the background']}},
   {'say': 'Third: zero-copy. To send messages, Kafka asks the operating system to move bytes from the page cache straight to the network card, without copying them through Kafka\'s own memory.',
    'show': {'t': 'flow', 'items': ['Page cache', 'Network card', 'Consumer'], 'note': 'no copy through the Kafka process'}},
   {'say': 'Fourth: batching. Producers send many messages in one compressed request, so one write and one network trip carry thousands of messages. Spread partitions over brokers and it all runs in parallel.',
    'show': {'t': 'points', 'items': ['Batch: thousands of messages per request', 'Compress the batch (lz4, zstd)', 'Partitions on many brokers work in parallel']}}],
  'check': {'q': 'A consumer is keeping up with the newest messages. Where do its reads mostly come from?', 'opts': ['A disk seek for every message', 'The operating system\'s page cache in memory', 'Kafka\'s Java heap'], 'ans': 1,
            'why': 'Recent data is still in the page cache, so it is served from memory. A consumer far behind reads old data from disk and is slower: another reason to watch consumer lag.'},
  'work': ['Leave most broker RAM to the OS page cache; keep the Java heap modest', 'Turn on producer batching and compression: linger.ms, batch.size, compression.type', 'Alert on consumer lag: a lagging consumer reads from disk and falls further behind']},
]
