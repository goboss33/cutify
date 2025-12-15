"""
Migration script for Supabase - Add ALL missing Pipeline V6 columns
"""
from database import engine
from sqlalchemy import text

# All columns that should exist
migrations = [
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'French'",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_duration TEXT DEFAULT '60s'",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_preset_id INTEGER",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS onboarding_context TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS pipeline_metadata TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS context_data TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS scene_plan_data TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS asset_plan_data TEXT",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS screenplay_data TEXT",
]

print("Running Supabase migration...")

with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            col_name = sql.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
            print(f"OK: {col_name}")
        except Exception as e:
            print(f"ERROR: {e}")
    conn.commit()

print("\nMigration complete! Restart backend.")
