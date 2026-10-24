# Airflow + two isolated tool environments: ~/jobs (PyIceberg, PyArrow, Trino client) and ~/dbt (dbt-trino).
# Keeping them out of Airflow's own environment avoids dependency clashes, the usual pain of "pip install dbt into Airflow".
FROM apache/airflow:2.10.5-python3.11
USER airflow
RUN python -m venv /home/airflow/jobs && /home/airflow/jobs/bin/pip install --no-cache-dir "pyiceberg[pyarrow]==0.9.1" "trino==0.340.0" && \
    python -m venv /home/airflow/dbt && /home/airflow/dbt/bin/pip install --no-cache-dir "dbt-trino==1.9.3"
