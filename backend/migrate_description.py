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

print(f"Connecting to database for description column migration...")
print(f"Database type: {'PostgreSQL/Supabase' if 'postgresql' in DATABASE_URL else 'SQLite'}")

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def migrate():
    is_postgres = "postgresql" in DATABASE_URL
    
    with engine.connect() as conn:
        print("Adding description columns to characters and locations tables...")
        
        # Add description column to characters table
        try:
            if is_postgres:
                conn.execute(text("ALTER TABLE characters ADD COLUMN IF NOT EXISTS description TEXT"))
            else:
                conn.execute(text("ALTER TABLE characters ADD COLUMN description TEXT"))
            print("Added 'description' to characters table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column 'description' already exists in characters.")
            else:
                print(f"Error adding 'description' to characters: {e}")
        
        # Add description column to locations table
        try:
            if is_postgres:
                conn.execute(text("ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT"))
            else:
                conn.execute(text("ALTER TABLE locations ADD COLUMN description TEXT"))
            print("Added 'description' to locations table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column 'description' already exists in locations.")
            else:
                print(f"Error adding 'description' to locations: {e}")
        
        conn.commit()
        print("Description columns migration complete.")

if __name__ == "__main__":
    migrate()
