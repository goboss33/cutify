import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

# Load env same as database.py
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cutify.db")
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

print(f"Connecting to database...") # Don't log URL for security if it's external

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def migrate():
    with engine.connect() as conn:
        print("Checking schema...")
        # Check columns. This logic works for postgres broadly, handling case sensitivity might be needed.
        # But simpler to just try adding columns and ignore "already exists" errors if we were using raw SQL.
        # Since we might be on SQLite local or Postgres remote, standard ALTER TABLE works for both for adding columns.
        
        columns_to_add = [
            ("language", "VARCHAR DEFAULT 'French'"),
            ("target_duration", "VARCHAR DEFAULT '60s'"),
            ("aspect_ratio", "VARCHAR DEFAULT '16:9'")
        ]

        # Since we can't easily query schema across different DB types uniformly without inspection,
        # we'll try to add them one by one.
        
        for col, type_def in columns_to_add:
            try:
                print(f"Adding '{col}'...")
                conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} {type_def}"))
                print(f"Added {col}.")
            except Exception as e:
                # Rudimentary check if it failed because it exists
                if "duplicate column" in str(e) or "already exists" in str(e):
                    print(f"Column '{col}' already exists.")
                else:
                    print(f"Error adding '{col}': {e}")
        
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
