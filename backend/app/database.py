import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


backend_dir = Path(__file__).resolve().parents[1]
project_dir = backend_dir.parent
load_dotenv(project_dir / ".env")
load_dotenv(backend_dir / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./grit_interviews.db")
database_url = make_url(DATABASE_URL)
if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg")
    if database_url.host and (
        database_url.host.endswith(".supabase.co")
        or database_url.host.endswith(".pooler.supabase.com")
    ) and "sslmode" not in database_url.query:
        database_url = database_url.update_query_dict({"sslmode": "require"})
DATABASE_URL = database_url.render_as_string(hide_password=False)

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
