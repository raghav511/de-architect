"""Settings for the pipeline, read from environment variables."""
import os

WAREHOUSE_PATH = os.environ.get('WAREHOUSE_PATH', 'warehouse.db')
WAREHOUSE_TOKEN = os.environ.get('WAREHOUSE_TOKEN', '')
DEBUG = os.environ.get('DEBUG', '0') == '1'
