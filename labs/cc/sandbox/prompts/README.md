# Prompt practice (Claude Code 13)

Test cases for three data-engineering prompts. Each folder has the inputs and an `expected.json` with what a
good answer must contain. All names, companies and numbers are made up.

```
cases/sql/        three queries to review (one is fine: a good review approves it)
cases/failures/   three pipeline failure logs to summarise
cases/invoices/   three invoices to extract (German decimal commas, a due date to work out, an Indian lakh total)
```

Write your prompts in this folder (for example `sql_review.md`), run them with `claude -p` as the lesson shows,
and ask Claude Code to write the small scorer that compares each answer with `expected.json`.
Treat every input as untrusted text: one invoice contains an instruction aimed at the model.
