"""Makes synthetic support tickets for the Claude Code 14 lab (all text is made up).

  python3 llm/make_tickets.py            writes llm/tickets.csv (2,000 tickets) and llm/labelled.csv (40 with a true label)

The same seed always gives the same files, so a rerun changes nothing."""
import csv, random, os

LABELS = {
    'billing': ['I was charged twice for order {o}', 'The invoice for order {o} shows the wrong VAT', 'Why is my card charged {a} EUR when the basket said less?', 'Please send a corrected invoice for {o}'],
    'delivery': ['Order {o} has not arrived after 9 days', 'The courier left order {o} at the wrong address', 'Tracking for {o} has not moved since Monday', 'Can you deliver {o} on Saturday instead?'],
    'refund': ['I returned order {o} two weeks ago, where is my refund?', 'Please refund {a} EUR for the broken item in {o}', 'Refund for {o} went to an old card', 'I cancelled {o} within an hour, I want my money back'],
    'account': ['I cannot log in, the reset email never comes', 'Please change the email on my account', 'Delete my account and my data please', 'Two-factor codes stopped working on my new phone'],
    'bug': ['The checkout page shows 12,50 as 1250', 'App crashes when I open order {o}', 'The discount code field accepts nothing', 'Search returns orders from another country'],
    'other': ['Do you sell gift cards?', 'Great service last week, thank you!', 'Are you hiring data engineers?', 'What are your opening hours at the Pune pickup point?'],
}
TAIL = ['', ' Thanks.', ' This is urgent.', ' Second time I write about this.', ' (sent from my phone)', ' Regards, a customer']


def main(here=os.path.dirname(os.path.abspath(__file__))):
    rnd = random.Random(14)
    rows = []
    for i in range(2000):
        label = rnd.choice(list(LABELS))
        text = rnd.choice(LABELS[label]).format(o=88000 + rnd.randrange(9000), a='%d,%02d' % (rnd.randrange(5, 400), rnd.randrange(100)))
        text = (text if text.endswith(('?', '!')) else text + '.') + rnd.choice(TAIL)
        rows.append(('T%05d' % (i + 1), text, label))
    with open(os.path.join(here, 'tickets.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['ticket_id', 'text']); w.writerows(r[:2] for r in rows)
    with open(os.path.join(here, 'labelled.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['ticket_id', 'text', 'label']); w.writerows(rows[:40])
    print('wrote llm/tickets.csv (2,000 tickets) and llm/labelled.csv (40 labelled)')


if __name__ == '__main__':
    main()
