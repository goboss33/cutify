"""
Migration script to add onboarding_context column to projects table.
"""
from sqlalchemy import text
from database import engine

def add_onboarding_context_column():
    """Add onboarding_context column to projects table if it doesn't exist."""
    print("Checking if onboarding_context column exists...")
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'onboarding_context'
        """))
        
        if result.fetchone():
            print("Column onboarding_context already exists, skipping.")
            return
        
        # Add the column
        print("Adding onboarding_context column to projects table...")
        conn.execute(text("""
            ALTER TABLE projects 
            ADD COLUMN onboarding_context TEXT
        """))
        conn.commit()
        print("Column added successfully!")

if __name__ == "__main__":
    add_onboarding_context_column()
