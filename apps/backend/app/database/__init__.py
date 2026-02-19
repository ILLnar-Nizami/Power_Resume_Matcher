"""Database repository layer for PostgreSQL operations.

This module provides a repository pattern interface that replaces
the previous TinyDB implementation with PostgreSQL.
"""

import asyncio
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_session
from app.database.models import Resume, Job, Improvement

logger = logging.getLogger(__name__)


class Database:
    """PostgreSQL database repository for resume matcher."""

    _master_resume_lock = asyncio.Lock()

    async def close(self) -> None:
        """Close database connection (no-op for SQLAlchemy)."""
        # SQLAlchemy handles connection pooling automatically
        pass

    # Resume operations
    async def create_resume(
        self,
        content: str,
        content_type: str = "md",
        filename: str | None = None,
        is_master: bool = False,
        is_confirmed: bool = False,
        parent_id: str | None = None,
        processed_data: dict[str, Any] | None = None,
        processing_status: str = "pending",
        cover_letter: str | None = None,
        outreach_message: str | None = None,
        title: str | None = None,
    ) -> dict[str, Any]:
        """Create a new resume entry."""
        async with get_session() as session:
            parent_uuid = UUID(parent_id) if parent_id else None

            resume = Resume(
                content=content,
                content_type=content_type,
                filename=filename,
                is_master=is_master,
                is_confirmed=is_confirmed,
                parent_id=parent_uuid,
                processed_data=processed_data,
                processing_status=processing_status,
                cover_letter=cover_letter,
                outreach_message=outreach_message,
                title=title,
            )

            session.add(resume)
            await session.flush()  # Get the ID

            return resume.to_dict()

    async def create_resume_atomic_master(
        self,
        content: str,
        content_type: str = "md",
        filename: str | None = None,
        processed_data: dict[str, Any] | None = None,
        processing_status: str = "pending",
        cover_letter: str | None = None,
        outreach_message: str | None = None,
    ) -> dict[str, Any]:
        """Create a new resume with atomic master assignment."""
        async with self._master_resume_lock:
            async with get_session() as session:
                # Check for existing master
                current_master = await self._get_master_resume_internal(session)
                is_master = current_master is None

                # Recovery behavior: if current master is stuck in failed state
                if (
                    current_master
                    and current_master.get("processing_status") == "failed"
                ):
                    await session.execute(
                        update(Resume)
                        .where(Resume.id == UUID(current_master["resume_id"]))
                        .values(is_master=False)
                    )
                    is_master = True

                return await self.create_resume(
                    content=content,
                    content_type=content_type,
                    filename=filename,
                    is_master=is_master,
                    is_confirmed=False,
                    processed_data=processed_data,
                    processing_status=processing_status,
                    cover_letter=cover_letter,
                    outreach_message=outreach_message,
                )

    async def _get_master_resume_internal(
        self, session: AsyncSession
    ) -> dict[str, Any] | None:
        """Get master resume using provided session."""
        result = await session.execute(select(Resume).where(Resume.is_master == True))
        resume = result.scalar_one_or_none()
        return resume.to_dict() if resume else None

    async def get_resume(self, resume_id: str) -> dict[str, Any] | None:
        """Get resume by ID."""
        async with get_session() as session:
            result = await session.execute(
                select(Resume).where(Resume.id == UUID(resume_id))
            )
            resume = result.scalar_one_or_none()
            return resume.to_dict() if resume else None

    async def get_master_resume(self) -> dict[str, Any] | None:
        """Get the master resume if exists."""
        async with get_session() as session:
            return await self._get_master_resume_internal(session)

    async def update_resume(
        self, resume_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update resume by ID."""
        async with get_session() as session:
            # Remove resume_id from updates if present
            updates.pop("resume_id", None)

            result = await session.execute(
                update(Resume)
                .where(Resume.id == UUID(resume_id))
                .values(**updates)
                .returning(Resume)
            )
            resume = result.scalar_one_or_none()

            if not resume:
                raise ValueError(f"Resume not found: {resume_id}")

            return resume.to_dict()

    async def delete_resume(self, resume_id: str) -> bool:
        """Delete resume by ID. Also deletes related improvements, jobs, and child resumes."""
        async with get_session() as session:
            resume_uuid = UUID(resume_id)

            # First, find and delete all child resumes (tailored versions)
            child_resumes = await session.execute(
                select(Resume.id).where(Resume.parent_id == resume_uuid)
            )
            child_ids = [r[0] for r in child_resumes.fetchall()]

            # Delete improvements for each child resume
            for child_id in child_ids:
                await session.execute(
                    delete(Improvement).where(
                        (Improvement.tailored_resume_id == child_id)
                    )
                )

            # Delete child resumes
            await session.execute(delete(Resume).where(Resume.parent_id == resume_uuid))

            # Delete related improvements
            await session.execute(
                delete(Improvement).where(
                    (Improvement.original_resume_id == resume_uuid)
                    | (Improvement.tailored_resume_id == resume_uuid)
                )
            )

            # Delete jobs that reference this resume (as resume_id)
            await session.execute(delete(Job).where(Job.resume_id == resume_uuid))

            # Finally delete the resume itself
            result = await session.execute(
                delete(Resume).where(Resume.id == resume_uuid)
            )
            return result.rowcount > 0

    async def list_resumes(self) -> list[dict[str, Any]]:
        """List all resumes."""
        async with get_session() as session:
            result = await session.execute(select(Resume))
            resumes = result.scalars().all()
            return [r.to_dict() for r in resumes]

    async def set_master_resume(self, resume_id: str) -> bool:
        """Set a resume as the master, unsetting any existing master."""
        async with get_session() as session:
            # First verify the target resume exists
            target_result = await session.execute(
                select(Resume).where(Resume.id == UUID(resume_id))
            )
            if not target_result.scalar_one_or_none():
                logger.warning("Cannot set master: resume %s not found", resume_id)
                return False

            # Unset current master
            await session.execute(
                update(Resume).where(Resume.is_master == True).values(is_master=False)
            )

            # Set new master
            result = await session.execute(
                update(Resume)
                .where(Resume.id == UUID(resume_id))
                .values(is_master=True)
            )

            return result.rowcount > 0

    # Job operations
    async def create_job(
        self,
        content: str,
        resume_id: str | None = None,
        company_name: str | None = None,
        role: str | None = None,
    ) -> dict[str, Any]:
        """Create a new job description entry."""
        async with get_session() as session:
            resume_uuid = UUID(resume_id) if resume_id else None

            job = Job(
                content=content,
                resume_id=resume_uuid,
                company_name=company_name,
                role=role,
            )
            session.add(job)
            await session.flush()

            return job.to_dict()

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Get job by ID."""
        async with get_session() as session:
            result = await session.execute(select(Job).where(Job.id == UUID(job_id)))
            job = result.scalar_one_or_none()
            return job.to_dict() if job else None

    async def update_job(
        self, job_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Update a job by ID."""
        async with get_session() as session:
            updates.pop("job_id", None)

            result = await session.execute(
                update(Job)
                .where(Job.id == UUID(job_id))
                .values(**updates)
                .returning(Job)
            )
            job = result.scalar_one_or_none()

            return job.to_dict() if job else None

    # Improvement operations
    async def create_improvement(
        self,
        original_resume_id: str,
        tailored_resume_id: str,
        job_id: str,
        improvements: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Create an improvement result entry."""
        async with get_session() as session:
            improvement = Improvement(
                original_resume_id=UUID(original_resume_id),
                tailored_resume_id=UUID(tailored_resume_id),
                job_id=UUID(job_id) if job_id else None,
                improvements=improvements,
            )
            session.add(improvement)
            await session.flush()

            return improvement.to_dict()

    async def get_improvement_by_tailored_resume(
        self, tailored_resume_id: str
    ) -> dict[str, Any] | None:
        """Get improvement record by tailored resume ID."""
        async with get_session() as session:
            result = await session.execute(
                select(Improvement).where(
                    Improvement.tailored_resume_id == UUID(tailored_resume_id)
                )
            )
            improvement = result.scalar_one_or_none()
            return improvement.to_dict() if improvement else None

    # Stats
    async def get_stats(self) -> dict[str, Any]:
        """Get database statistics."""
        async with get_session() as session:
            # Count resumes
            resume_count = await session.execute(select(func.count(Resume.id)))
            total_resumes = resume_count.scalar()

            # Count jobs
            job_count = await session.execute(select(func.count(Job.id)))
            total_jobs = job_count.scalar()

            # Count improvements
            improvement_count = await session.execute(
                select(func.count(Improvement.id))
            )
            total_improvements = improvement_count.scalar()

            # Check for master resume
            master_result = await session.execute(
                select(func.count(Resume.id)).where(Resume.is_master == True)
            )
            has_master = master_result.scalar() > 0

            return {
                "total_resumes": total_resumes,
                "total_jobs": total_jobs,
                "total_improvements": total_improvements,
                "has_master_resume": has_master,
            }

    async def reset_database(self) -> None:
        """Reset the database by truncating all tables."""
        async with get_session() as session:
            # Delete in order to respect foreign keys
            await session.execute(delete(Improvement))
            await session.execute(delete(Job))
            await session.execute(delete(Resume))


# Global database instance
db = Database()
