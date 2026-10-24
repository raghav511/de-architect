"""Lab 1 reference solution. Try it yourself first: labs/lab1_loop.py
Test:  python -m pytest tests/test_lab1.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import llm, tools

SYSTEM = 'You are a careful assistant. Use the tools for maths and for reading files. Answer in one line.'

def run_agent(question, tool_names=('calculator', 'read_file'), max_steps=6):
    messages = [{'role': 'user', 'content': question}]
    specs = tools.specs(list(tool_names))
    for _ in range(max_steps):
        reply = llm.chat(SYSTEM, messages, specs)
        if not reply.tool_calls:
            return reply.text
        messages.append({'role': 'assistant', 'content': reply.text, 'tool_calls': reply.tool_calls})
        for call in reply.tool_calls:
            messages.append({'role': 'tool', 'tool_call_id': call['id'], 'content': tools.run(call)})
    return 'STOPPED: step budget reached'

QUESTIONS = ['What is 1234 * 56 + 7?', 'What is in data/orders.txt?', 'Read data/orders.txt and add up the amount column: give the total.']

if __name__ == '__main__':
    for q in QUESTIONS:
        print('Q:', q)
        print('A:', run_agent(q), '\n')
