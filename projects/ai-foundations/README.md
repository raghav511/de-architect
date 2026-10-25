# AI foundations: build agents from scratch

Labs for modules A1–A3 of the Data Architect program. Everything runs **offline and free** with `PROVIDER=mock`; switch to a real model (Gemini free tier, a local Ollama model, Groq, or Anthropic) when the tests pass.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set PROVIDER and API_KEY
python -m pytest -q tests     # lab 1 fails until you fill its TODOs
```

| Lab | File | Done when |
|---|---|---|
| 1 Agent loop | `labs/lab1_loop.py` | `pytest tests/test_lab1.py` passes |
| 2 Stop conditions + trace | `harness/agent.py`, `tests/test_lab2.py` | tests pass; `python -m harness.trace traces/<run>.jsonl` shows a timeline |
| 3 Prompt cost/quality | `labs/lab3_prompts.py`, `prompts/` | `reports/lab3.md` with accuracy, tokens, cost |
| 4 Automate | `automations/daily_report.py`, `workflows/daily-report.yml.example` | the workflow ran on schedule and overwrote the day's report |
| 5 Evals | `labs/lab5_evals.py` | `reports/lab5.md` with 3 graders and disagreements |
| 6 Self-fixing agent | `labs/lab6_selffix.py --reset` | all task tests pass, tests untouched |
| 7 Self-improving prompt | `labs/lab7_optimise.py` | train and held-out per round, overfitting judged |
| 8 Lessons memory | `memory/lessons.md` | fewer iterations on the second run |
| 9 MCP server | `labs/lab9_mcp_server.py`, `labs/lab9_client.py` | client lists 3 tools; `DROP` is refused |
| 10 On-call agent | `labs/lab10_oncall.py` (needs the lakehouse project) | incident report with evidence; patch waits for approval |
| 11 Agent eval | `labs/lab11_eval.py` | cause rate, unsafe actions = 0, cost per incident |

Free model options: **Gemini** (free tier key from Google AI Studio; set `PROVIDER=gemini`), **Ollama** in Codespaces or on your Mac (`ollama pull qwen2.5:3b`; `PROVIDER=ollama`), **Groq** free tier (`PROVIDER=groq`). Prices in `harness/llm.py` are for reporting only; check your provider's current pricing.

Solutions for lab 1 are in `solutions/`; try it yourself first.
