from sqlalchemy.engine import make_url
import urllib.parse

url_str = "postgresql://postgres.lengolmmiwmrmlmzswek:Sahbi@.147tictac@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
try:
    url = make_url(url_str)
    print(f"User: {url.username}")
    print(f"Password: {url.password}")
    print(f"Host: {url.host}")
except Exception as e:
    print(f"Error: {e}")
