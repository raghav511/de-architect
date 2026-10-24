"""Daily medallion pipeline: land -> bronze (zero copy) -> silver -> gold (dbt) -> checks.
Each task is idempotent, so a rerun of any day gives the same tables."""
import pendulum
from airflow import DAG
from airflow.operators.bash import BashOperator

LAKE = '/opt/lakehouse'
PY = '/home/airflow/jobs/bin/python'
DBT = '/home/airflow/dbt/bin/dbt'
ENV = {'S3_ENDPOINT': 'http://s3:8333', 'CATALOG_URI': 'http://rest:8181', 'TRINO_HOST': 'trino', 'DBT_PROFILES_DIR': f'{LAKE}/dbt',
       'AWS_ACCESS_KEY_ID': 'admin', 'AWS_SECRET_ACCESS_KEY': 'password', 'AWS_REGION': 'us-east-1'}
with DAG('lakehouse_daily', start_date=pendulum.datetime(2026, 10, 1, tz='UTC'), schedule='@daily', catchup=False, max_active_runs=1,
         default_args={'retries': 1, 'retry_delay': pendulum.duration(minutes=1)}, tags=['lakehouse', 'week2']) as dag:
    land = BashOperator(task_id='land_raw_files', env=ENV, append_env=True,
                        bash_command=f'{PY} {LAKE}/generator/generate.py --days 1 --start {{{{ ds }}}} --seed {{{{ macros.ds_format(ds, "%Y-%m-%d", "%j") | int }}}}')
    bronze = BashOperator(task_id='bronze_zero_copy', env=ENV, append_env=True, bash_command=f'{PY} {LAKE}/jobs/bronze_zero_copy.py')
    events = BashOperator(task_id='bronze_events', env=ENV, append_env=True, bash_command=f'{PY} {LAKE}/jobs/bronze_events.py')
    silver = BashOperator(task_id='silver_merge', env=ENV, append_env=True, bash_command=f'{PY} {LAKE}/jobs/run_sql.py {LAKE}/jobs/silver.sql')
    gold = BashOperator(task_id='gold_dbt_build', env=ENV, append_env=True, bash_command=f'cd {LAKE}/dbt && {DBT} build --target-path /tmp/dbt-target --log-path /tmp/dbt-logs')
    checks = BashOperator(task_id='checks', env=ENV, append_env=True, bash_command=f'{PY} {LAKE}/checks/check.py')
    land >> [bronze, events] >> silver >> gold >> checks
