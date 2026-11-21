# An LLM step in a pipeline (Claude Code 14)

`python3 llm/make_tickets.py` writes 2,000 made-up support tickets (`llm/tickets.csv`) and 40 with a true
label (`llm/labelled.csv`). The lab asks you to build, with Claude Code, a classification step that is
idempotent, cached, cheap and checked:

```
llm/classify.py    one ticket at a time, results in llm/results.db keyed by ticket, input hash, prompt version and model
llm/batch.py       the same prompt for many tickets through the Message Batches API, joined back by custom_id
llm/cost.py        the cost table for 1,000,000 tickets: model, caching and batch
```

The API steps need an API key from the Anthropic Console in `ANTHROPIC_API_KEY` (in your shell, never in a
file in this folder). Without one, run the same prompt through `claude -p` for the 40 labelled tickets and
do the batch and cost steps as a dry run.
