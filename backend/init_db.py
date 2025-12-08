from backend.database import engine, Base
from backend.models import ProjectDB

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
