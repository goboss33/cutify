import os
from dotenv import load_dotenv
from pathlib import Path
from sqlalchemy import create_engine
import sys

# Load env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

url = os.getenv("DATABASE_URL")
if not url:
    print("NO DATABASE_URL FOUND")
    sys.exit(1)

# Mask password for display
safe_url = url
if ":" in url and "@" in url:
    part1, part2 = url.split("://")
    creds, host = part2.split("@")
    if ":" in creds:
        user, _ = creds.split(":")
        safe_url = f"{part1}://{user}:***@{host}"

print(f"Attempting to connect to: {safe_url}")

try:
    engine = create_engine(url)
    conn = engine.connect()
    print("Connection SUCCESS!")
    conn.close()
except Exception as e:
    print(f"Connection FAILED: {e}")
