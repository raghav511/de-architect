"""Lab 1: your first agent loop. Fill the three TODOs, then run:  python labs/lab1_loop.py
Test:  python -m pytest tests/test_lab1.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm, tools

SYSTEM = 'You are a careful assistant. Use the tools for maths and for reading files. Answer in one line.'

def run_agent(question, tool_names=('calculator', 'read_file'), max_steps=6):
    messages = [{'role': 'user', 'content': question}]
    specs = tools.specs(list(tool_names))
    for _ in range(max_steps):
        # TODO 1: call the model:  reply = llm.chat(SYSTEM, messages, specs)
        reply = None
        # TODO 2: if the reply has no tool calls, return reply.text
        # TODO 3: otherwise append {'role': 'assistant', 'content': reply.text, 'tool_calls': reply.tool_calls}
        #         then for each call append {'role': 'tool', 'tool_call_id': call['id'], 'content': tools.run(call)}
        raise NotImplementedError('fill the TODOs in run_agent')
    return 'STOPPED: step budget reached'

QUESTIONS = ['What is 1234 * 56 + 7?', 'What is in data/orders.txt?', 'Read data/orders.txt and add up the amount column: give the total.']

if __name__ == '__main__':
    for q in QUESTIONS:
        print('Q:', q)
        print('A:', run_agent(q), '\n')
