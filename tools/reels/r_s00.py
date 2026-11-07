# Start here: how the program works and what you will build.
MID = 's00'
REELS = [
 {'sec': 'The platform you will build', 'title': 'The platform you will build', 'beats': [
   {'say': 'Over this program you build one data platform for Meridian, a ride-hailing and food delivery company. Every module adds one layer while the rest keeps running.',
    'show': {'t': 'big', 'text': 'One platform', 'sub': 'built a layer at a time'}},
   {'say': 'Rider and driver apps send events to Kafka. Orders change in Postgres, and Debezium captures each change. Spark processes both, in batch and in streams, into Iceberg tables on object storage.',
    'show': {'t': 'flow', 'items': ['Apps and Postgres', 'Kafka and Debezium', 'Spark', 'Iceberg tables']}},
   {'say': 'dbt turns those tables into clean models that Trino, Snowflake and Databricks serve to dashboards. Airflow schedules every step, and an on-call agent reads failures and reports them.',
    'show': {'t': 'flow', 'items': ['dbt models', 'Trino, Snowflake, Databricks', 'Dashboards'], 'note': 'Airflow schedules it; an agent watches it'}}],
  'check': {'q': 'Which tool captures every change in the Postgres orders table?', 'opts': ['Airflow', 'Debezium', 'dbt'], 'ans': 1, 'why': 'Debezium reads the database log and turns each insert, update and delete into an event.'},
  'work': ['Draw your current platform in the same left-to-right way: sources, transport, processing, storage, serving', 'Mark which box has no owner or no monitoring']},
 {'sec': 'From a platform to a data foundation', 'title': 'From a platform to a foundation', 'beats': [
   {'say': 'A platform that one engineer runs is not yet a foundation a company can build on. Other teams need to use it without asking you every time.',
    'show': {'t': 'big', 'text': 'Platform to foundation', 'sub': 'other teams use it without you'}},
   {'say': 'Three things make the difference. Golden paths: a template that creates a new pipeline in minutes. Governance: every dataset has an owner, a class like personal or public, and a rule for who may read it and how long it is kept.',
    'show': {'t': 'points', 'items': ['Golden paths: templates', 'Governance: owners, classes, access, retention']}},
   {'say': 'And the platform run as a product: onboarding, docs, published service levels, and showing each team what it costs. Modules O1 to O5 teach this.',
    'show': {'t': 'points', 'items': ['Platform as a product', 'Onboarding, docs, service levels, cost', 'Modules O1 to O5']}}],
  'check': {'q': 'What is a golden path?', 'opts': ['A ready-made template that sets up a new pipeline the approved way', 'The fastest network route', 'A dashboard for executives'], 'ans': 0, 'why': 'It makes the right way the easy way: tests, logging and CI come with the template.'},
  'work': ['List what a new team must ask you before building a pipeline today: each item is a golden path to build', 'Give every important table a named owner']},
]
