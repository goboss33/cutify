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

print(f"Connecting to database for assets migration...")
print(f"Database type: {'PostgreSQL/Supabase' if 'postgresql' in DATABASE_URL else 'SQLite'}")

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def migrate():
    is_postgres = "postgresql" in DATABASE_URL
    
    with engine.connect() as conn:
        print("Running asset tables migration...")
        
        # Use different syntax for PostgreSQL vs SQLite
        if is_postgres:
            # PostgreSQL syntax for Supabase
            
            # Create characters table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS characters (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        name VARCHAR NOT NULL,
                        image_url VARCHAR
                    )
                """))
                print("Created 'characters' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'characters' already exists.")
                else:
                    print(f"Error creating 'characters': {e}")
            
            # Create locations table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS locations (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        name VARCHAR NOT NULL,
                        image_url VARCHAR
                    )
                """))
                print("Created 'locations' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'locations' already exists.")
                else:
                    print(f"Error creating 'locations': {e}")
            
            # Create scene_characters association table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS scene_characters (
                        scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
                        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                        PRIMARY KEY (scene_id, character_id)
                    )
                """))
                print("Created 'scene_characters' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'scene_characters' already exists.")
                else:
                    print(f"Error creating 'scene_characters': {e}")
            
            # Add location_id column to scenes table (PostgreSQL)
            try:
                conn.execute(text("ALTER TABLE scenes ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id)"))
                print("Added 'location_id' to scenes table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Column 'location_id' already exists in scenes.")
                else:
                    print(f"Error adding 'location_id': {e}")
        
        else:
            # SQLite syntax (original)
            
            # Create characters table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS characters (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        name VARCHAR NOT NULL,
                        image_url VARCHAR
                    )
                """))
                print("Created 'characters' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'characters' already exists.")
                else:
                    print(f"Error creating 'characters': {e}")
            
            # Create locations table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS locations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                        name VARCHAR NOT NULL,
                        image_url VARCHAR
                    )
                """))
                print("Created 'locations' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'locations' already exists.")
                else:
                    print(f"Error creating 'locations': {e}")
            
            # Create scene_characters association table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS scene_characters (
                        scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
                        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                        PRIMARY KEY (scene_id, character_id)
                    )
                """))
                print("Created 'scene_characters' table.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("Table 'scene_characters' already exists.")
                else:
                    print(f"Error creating 'scene_characters': {e}")
            
            # Add location_id column to scenes table (SQLite)
            try:
                conn.execute(text("ALTER TABLE scenes ADD COLUMN location_id INTEGER REFERENCES locations(id)"))
                print("Added 'location_id' to scenes table.")
            except Exception as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    print("Column 'location_id' already exists in scenes.")
                else:
                    print(f"Error adding 'location_id': {e}")
        
        conn.commit()
        print("Assets migration complete.")

if __name__ == "__main__":
    migrate()
