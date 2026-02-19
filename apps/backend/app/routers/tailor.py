"""Tailor endpoint for job description management."""

from fastapi import APIRouter, HTTPException

from app.database import db
from app.schemas import TailorJobRequest, TailorJobResponse

router = APIRouter(prefix="/tailor", tags=["Tailor"])


@router.post("", response_model=TailorJobResponse)
async def create_tailor_job(request: TailorJobRequest) -> TailorJobResponse:
    """Create a job description entry for resume tailoring.

    Accepts separate input fields for company name, role/position,
    and job description. This provides a dedicated endpoint for
    manual input when automatic CV parsing fails to extract these fields.

    The endpoint stores the job description in the database and returns
    the job_id for use in subsequent tailoring operations.
    """
    if not request.job_description or not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is required")

    job_description = request.job_description.strip()

    if len(job_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Job description must be at least 10 characters",
        )

    company_name = None
    if request.company_name:
        company_name = request.company_name.strip()[:255]

    role = None
    if request.role:
        role = request.role.strip()[:255]

    try:
        job = await db.create_job(
            content=job_description,
            resume_id=request.resume_id,
            company_name=company_name,
            role=role,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

    return TailorJobResponse(
        message="Job description created successfully",
        job_id=job["job_id"],
        company_name=company_name,
        role=role,
        request={
            "job_description": job_description,
            "company_name": company_name,
            "role": role,
            "resume_id": request.resume_id,
        },
    )


@router.get("/{job_id}", response_model=TailorJobResponse)
async def get_tailor_job(job_id: str) -> TailorJobResponse:
    """Get a job description by ID for tailoring."""
    job = await db.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return TailorJobResponse(
        message="Job retrieved successfully",
        job_id=job["job_id"],
        company_name=job.get("company_name"),
        role=job.get("role"),
        request={
            "job_description": job.get("content"),
            "company_name": job.get("company_name"),
            "role": job.get("role"),
            "resume_id": job.get("resume_id"),
        },
    )
