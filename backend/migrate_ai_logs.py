"""
Migration script to add AI Logs table to the database.
Run this once to create the ai_logs table.
"""
from database import engine, Base
from models import AILogDB

def migrate():
    print("Creating ai_logs table...")
    # Create only the ai_logs table if it doesn't exist
    AILogDB.__table__.create(engine, checkfirst=True)
    print("ai_logs table created successfully!")

if __name__ == "__main__":
    migrate()
