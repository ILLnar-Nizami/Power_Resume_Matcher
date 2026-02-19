"""SQLAlchemy database models for PostgreSQL."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class Resume(Base):
    """Resume model for storing resume data."""

    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(10), default="md")
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=True
    )
    processed_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending, processing, ready, failed
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    outreach_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    improvements_original: Mapped[list["Improvement"]] = relationship(
        "Improvement",
        foreign_keys="Improvement.original_resume_id",
        back_populates="original_resume",
    )
    improvements_tailored: Mapped[list["Improvement"]] = relationship(
        "Improvement",
        foreign_keys="Improvement.tailored_resume_id",
        back_populates="tailored_resume",
    )
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="resume")

    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "resume_id": str(self.id),
            "content": self.content,
            "content_type": self.content_type,
            "filename": self.filename,
            "is_master": self.is_master,
            "is_confirmed": self.is_confirmed,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "processed_data": self.processed_data,
            "processing_status": self.processing_status,
            "cover_letter": self.cover_letter,
            "outreach_message": self.outreach_message,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Job(Base):
    """Job description model."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=True
    )
    job_keywords: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    job_keywords_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preview_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preview_prompt_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preview_hashes: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    resume: Mapped[Resume | None] = relationship("Resume", back_populates="jobs")
    improvements: Mapped[list["Improvement"]] = relationship(
        "Improvement", back_populates="job"
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "job_id": str(self.id),
            "content": self.content,
            "company_name": self.company_name,
            "role": self.role,
            "resume_id": str(self.resume_id) if self.resume_id else None,
            "job_keywords": self.job_keywords,
            "job_keywords_hash": self.job_keywords_hash,
            "preview_hash": self.preview_hash,
            "preview_prompt_id": self.preview_prompt_id,
            "preview_hashes": self.preview_hashes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Improvement(Base):
    """Improvement record model."""

    __tablename__ = "improvements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    original_resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=False
    )
    tailored_resume_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id"), nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True
    )
    improvements: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    original_resume: Mapped[Resume] = relationship(
        "Resume",
        foreign_keys=[original_resume_id],
        back_populates="improvements_original",
    )
    tailored_resume: Mapped[Resume] = relationship(
        "Resume",
        foreign_keys=[tailored_resume_id],
        back_populates="improvements_tailored",
    )
    job: Mapped[Job | None] = relationship("Job", back_populates="improvements")

    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {
            "request_id": str(self.id),
            "original_resume_id": str(self.original_resume_id),
            "tailored_resume_id": str(self.tailored_resume_id),
            "job_id": str(self.job_id) if self.job_id else None,
            "improvements": self.improvements,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
