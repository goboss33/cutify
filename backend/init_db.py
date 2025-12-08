# --- Nouveau code ---
from database import engine, Base # On enlève "backend."
from models import ProjectDB     # On enlève "backend."

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
