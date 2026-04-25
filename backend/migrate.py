import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import *

try:
    print("Connecting to Supabase and creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Migration complete! You can now see your tables in Supabase.")
except Exception as e:
    print(f"Error during migration: {e}")
