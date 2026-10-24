"""Shared connections for jobs (run inside the spark or airflow container)."""
import os
import pyarrow.fs as pafs
S3_ENDPOINT = os.environ.get('S3_ENDPOINT', 'http://s3:8333')
KEY, SECRET = os.environ.get('AWS_ACCESS_KEY_ID', 'admin'), os.environ.get('AWS_SECRET_ACCESS_KEY', 'password')

def s3():
    return pafs.S3FileSystem(endpoint_override=S3_ENDPOINT, access_key=KEY, secret_key=SECRET, region='us-east-1', scheme='https' if S3_ENDPOINT.startswith('https') else 'http')

def catalog():
    from pyiceberg.catalog import load_catalog
    return load_catalog('lake', **{'type': 'rest', 'uri': os.environ.get('CATALOG_URI', 'http://rest:8181'), 's3.endpoint': S3_ENDPOINT,
                                   's3.access-key-id': KEY, 's3.secret-access-key': SECRET, 's3.path-style-access': 'true', 's3.region': 'us-east-1'})

def trino():
    import trino as t
    return t.dbapi.connect(host=os.environ.get('TRINO_HOST', 'trino'), port=int(os.environ.get('TRINO_PORT', '8080')), user='admin', catalog='lake')
