"""
Migration script to add category_preset_id column to projects table.
Run this to update the existing database schema.
"""
from sqlalchemy import text
from database import engine

def add_category_preset_id_column():
    """Add category_preset_id column to projects table if it doesn't exist."""
    print("Checking if category_preset_id column exists...")
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'category_preset_id'
        """))
        
        if result.fetchone():
            print("Column category_preset_id already exists, skipping.")
            return
        
        # Add the column
        print("Adding category_preset_id column to projects table...")
        conn.execute(text("""
            ALTER TABLE projects 
            ADD COLUMN category_preset_id INTEGER REFERENCES category_presets(id)
        """))
        conn.commit()
        print("Column added successfully!")

if __name__ == "__main__":
    add_category_preset_id_column()
