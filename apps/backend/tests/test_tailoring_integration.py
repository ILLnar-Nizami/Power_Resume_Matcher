"""Integration tests for resume tailoring functionality.

Tests the complete flow from job description upload to resume improvement confirmation.
Uses mock data to avoid external LLM calls.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from app.services.improver import (
    calculate_resume_diff,
    extract_job_keywords,
    improve_resume,
    generate_improvements,
)
from app.schemas import (
    ResumeData,
    ResumeDiffSummary,
    ResumeFieldDiff,
    ImproveResumeConfirmRequest,
)


# =============================================================================
# Mock Data Fixtures
# =============================================================================


@pytest.fixture
def mock_resume_data() -> dict:
    """Provide a realistic mock resume for testing."""
    return {
        "personalInfo": {
            "name": "John Doe",
            "title": "Software Engineer",
            "email": "john.doe@example.com",
            "phone": "+1 (555) 123-4567",
            "location": "San Francisco, CA",
            "linkedin": "linkedin.com/in/johndoe",
            "github": "github.com/johndoe",
        },
        "summary": "Experienced software engineer with 5+ years in full-stack development. Passionate about building scalable web applications and mentoring junior developers.",
        "workExperience": [
            {
                "id": 1,
                "title": "Senior Software Engineer",
                "company": "Tech Corp",
                "location": "San Francisco, CA",
                "years": "2020 - Present",
                "description": [
                    "Led development of microservices architecture serving 1M+ users",
                    "Mentored team of 5 junior engineers",
                    "Improved application performance by 40% through optimization",
                ],
            },
            {
                "id": 2,
                "title": "Software Engineer",
                "company": "Startup Inc",
                "location": "Palo Alto, CA",
                "years": "2018 - 2020",
                "description": [
                    "Built RESTful APIs using Python and FastAPI",
                    "Implemented CI/CD pipelines reducing deployment time by 60%",
                    "Collaborated with product team to deliver features on time",
                ],
            },
        ],
        "education": [
            {
                "id": 1,
                "institution": "Stanford University",
                "degree": "B.S. Computer Science",
                "years": "2014 - 2018",
                "description": "GPA: 3.8/4.0, Dean's List",
            }
        ],
        "additional": {
            "technicalSkills": [
                "Python",
                "JavaScript",
                "React",
                "Docker",
                "AWS",
                "PostgreSQL",
            ],
            "languages": ["English (Native)", "Spanish (Conversational)"],
            "certificationsTraining": [
                "AWS Certified Solutions Architect",
                "Docker Certified Associate",
            ],
            "awards": ["Employee of the Year 2022"],
        },
    }


@pytest.fixture
def mock_job_description() -> str:
    """Provide a realistic job description for testing."""
    return """
    Senior Full-Stack Engineer - AI/ML Team

    About the Role:
    We're looking for a Senior Full-Stack Engineer to join our AI/ML team and help build 
    cutting-edge machine learning platforms. You'll work with large-scale distributed systems 
    and modern cloud technologies.

    Requirements:
    - 5+ years of experience in software engineering
    - Strong proficiency in Python and TypeScript
    - Experience with React, Next.js, and modern frontend frameworks
    - Deep knowledge of cloud platforms (AWS/GCP/Azure)
    - Experience with Kubernetes and containerization
    - Knowledge of machine learning concepts and MLOps practices
    - Experience with vector databases (Pinecone, Weaviate)
    - Strong system design and architecture skills
    - Excellent communication and mentoring abilities

    Nice to Have:
    - Experience with LangChain or similar LLM frameworks
    - Contributions to open-source projects
    - Experience with event-driven architectures
    - Knowledge of GraphQL and gRPC

    Benefits:
    - Competitive salary and equity
    - Flexible remote work options
    - Learning and development budget
    - Health, dental, and vision insurance
    """


@pytest.fixture
def mock_job_keywords() -> dict:
    """Provide mock extracted job keywords."""
    return {
        "required_skills": [
            "Python",
            "TypeScript",
            "React",
            "Next.js",
            "AWS",
            "Kubernetes",
            "Docker",
            "Machine Learning",
            "MLOps",
            "System Design",
        ],
        "preferred_skills": [
            "LangChain",
            "LLM",
            "GraphQL",
            "gRPC",
            "Open Source",
            "Event-Driven Architecture",
        ],
        "experience_level": "Senior",
        "years_experience": 5,
        "domain": "AI/ML",
        "key_responsibilities": [
            "Build ML platforms",
            "Work with distributed systems",
            "Mentor team members",
            "System architecture",
        ],
    }


@pytest.fixture
def mock_improved_resume_data() -> dict:
    """Provide mock improved resume data."""
    return {
        "personalInfo": {
            "name": "John Doe",
            "title": "Senior Full-Stack Engineer | AI/ML Specialist",
            "email": "john.doe@example.com",
            "phone": "+1 (555) 123-4567",
            "location": "San Francisco, CA",
            "linkedin": "linkedin.com/in/johndoe",
            "github": "github.com/johndoe",
        },
        "summary": "Senior software engineer with 5+ years building scalable AI/ML platforms and distributed systems. Expert in Python, TypeScript, and cloud-native architectures. Proven track record in MLOps, system design, and mentoring high-performing engineering teams. Passionate about leveraging machine learning to solve complex business problems.",
        "workExperience": [
            {
                "id": 1,
                "title": "Senior Software Engineer",
                "company": "Tech Corp",
                "location": "San Francisco, CA",
                "years": "2020 - Present",
                "description": [
                    "Architected microservices platform serving 1M+ users using Kubernetes and Docker",
                    "Led MLOps initiative implementing CI/CD for ML models with 99.9% uptime",
                    "Mentored team of 5 engineers in Python, system design, and best practices",
                    "Optimized distributed systems achieving 40% performance improvement",
                ],
            },
            {
                "id": 2,
                "title": "Software Engineer",
                "company": "Startup Inc",
                "location": "Palo Alto, CA",
                "years": "2018 - 2020",
                "description": [
                    "Built scalable RESTful APIs using Python, FastAPI, and PostgreSQL",
                    "Implemented Kubernetes-based CI/CD pipelines reducing deployment time by 60%",
                    "Collaborated with ML team to deploy models to production",
                ],
            },
        ],
        "education": [
            {
                "id": 1,
                "institution": "Stanford University",
                "degree": "B.S. Computer Science",
                "years": "2014 - 2018",
                "description": "GPA: 3.8/4.0, Focus on Machine Learning and Distributed Systems",
            }
        ],
        "additional": {
            "technicalSkills": [
                "Python",
                "TypeScript",
                "React",
                "Next.js",
                "Docker",
                "Kubernetes",
                "AWS",
                "PostgreSQL",
                "Machine Learning",
                "MLOps",
                "System Design",
                "LangChain",
            ],
            "languages": ["English (Native)", "Spanish (Conversational)"],
            "certificationsTraining": [
                "AWS Certified Solutions Architect",
                "Docker Certified Associate",
                "Kubernetes Administrator (CKA)",
            ],
            "awards": ["Employee of the Year 2022"],
        },
    }


# =============================================================================
# Diff Calculation Tests
# =============================================================================


class TestResumeDiffCalculation:
    """Test the resume diff calculation functionality."""

    def test_calculate_diff_with_mock_data(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test diff calculation with realistic mock data."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        # Verify summary structure
        assert isinstance(summary, ResumeDiffSummary)
        assert summary.total_changes > 0
        assert summary.skills_added >= 0
        assert summary.skills_removed >= 0
        assert summary.descriptions_modified >= 0

        # Verify changes list
        assert isinstance(changes, list)
        assert len(changes) > 0
        assert all(isinstance(c, ResumeFieldDiff) for c in changes)

    def test_detects_summary_modification(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test that summary changes are detected."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        summary_changes = [c for c in changes if c.field_type == "summary"]
        assert len(summary_changes) == 1
        assert summary_changes[0].change_type == "modified"
        assert "AI/ML" in (summary_changes[0].new_value or "")

    def test_detects_skill_additions(self, mock_resume_data, mock_improved_resume_data):
        """Test that new skills are detected."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        added_skills = [
            c for c in changes if c.field_type == "skill" and c.change_type == "added"
        ]

        added_skill_names = [c.new_value for c in added_skills]
        assert "Kubernetes" in added_skill_names
        assert "Next.js" in added_skill_names
        assert "LangChain" in added_skill_names

    def test_detects_certification_additions(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test that new certifications are detected."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        cert_additions = [
            c
            for c in changes
            if c.field_type == "certification" and c.change_type == "added"
        ]

        assert len(cert_additions) == 1
        assert "CKA" in (cert_additions[0].new_value or "")

    def test_detects_description_modifications(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test that work experience description changes are detected."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        description_changes = [
            c
            for c in changes
            if c.field_type == "description" and c.change_type == "modified"
        ]

        assert len(description_changes) >= 1
        assert summary.descriptions_modified >= 1

    def test_high_risk_changes_identified(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test that high-risk changes (new skills) are properly flagged."""
        summary, changes = calculate_resume_diff(
            mock_resume_data, mock_improved_resume_data
        )

        # Newly added skills should be marked as high risk
        added_skills = [
            c for c in changes if c.field_type == "skill" and c.change_type == "added"
        ]

        high_risk_additions = [c for c in added_skills if c.confidence == "high"]
        assert len(high_risk_additions) > 0
        assert summary.high_risk_changes > 0

    def test_no_changes_for_identical_resumes(self, mock_resume_data):
        """Test that identical resumes produce no changes."""
        summary, changes = calculate_resume_diff(mock_resume_data, mock_resume_data)

        assert summary.total_changes == 0
        assert summary.skills_added == 0
        assert summary.skills_removed == 0
        assert summary.descriptions_modified == 0
        assert summary.high_risk_changes == 0
        assert len(changes) == 0


# =============================================================================
# Integration Tests with Mocked LLM
# =============================================================================


class TestTailoringIntegration:
    """Integration tests for the complete tailoring flow."""

    @pytest.mark.asyncio
    async def test_extract_job_keywords(self, mock_job_description, mock_job_keywords):
        """Test job keyword extraction with mocked LLM."""
        with patch("app.services.improver.complete_json") as mock_complete:
            mock_complete.return_value = mock_job_keywords

            result = await extract_job_keywords(mock_job_description)

            assert result == mock_job_keywords
            assert "required_skills" in result
            assert "Python" in result["required_skills"]
            mock_complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_improve_resume(
        self, mock_resume_data, mock_job_keywords, mock_improved_resume_data
    ):
        """Test resume improvement with mocked LLM."""
        with patch("app.services.improver.complete_json") as mock_complete:
            mock_complete.return_value = mock_improved_resume_data

            result = await improve_resume(
                original_resume=json.dumps(mock_resume_data),
                job_description="Mock job description",
                job_keywords=mock_job_keywords,
                language="en",
            )

            # Verify key fields are present and match (schema may add extra fields)
            assert (
                result["personalInfo"]["name"]
                == mock_improved_resume_data["personalInfo"]["name"]
            )
            assert (
                result["personalInfo"]["title"]
                != mock_resume_data["personalInfo"]["title"]
            )
            assert "AI/ML" in result["summary"]
            mock_complete.assert_called_once()

    def test_generate_improvements(self, mock_job_keywords):
        """Test improvement suggestions generation."""
        improvements = generate_improvements(mock_job_keywords)

        assert isinstance(improvements, list)
        assert len(improvements) > 0

        # Check that improvements mention key skills
        improvements_text = json.dumps(improvements).lower()
        assert "python" in improvements_text or "typescript" in improvements_text


# =============================================================================
# End-to-End Flow Tests
# =============================================================================


class TestTailoringEndToEnd:
    """End-to-end tests simulating the complete user flow."""

    @pytest.mark.asyncio
    async def test_complete_tailoring_flow(
        self,
        mock_resume_data,
        mock_job_description,
        mock_job_keywords,
        mock_improved_resume_data,
    ):
        """Test the complete tailoring flow from job description to improved resume."""

        # Step 1: Extract job keywords (mocked)
        with patch("app.services.improver.complete_json") as mock_llm:
            mock_llm.return_value = mock_job_keywords
            keywords = await extract_job_keywords(mock_job_description)

            assert "required_skills" in keywords
            assert len(keywords["required_skills"]) > 0

        # Step 2: Generate improvements
        improvements = generate_improvements(mock_job_keywords)
        assert len(improvements) > 0

        # Step 3: Improve resume (mocked)
        with patch("app.services.improver.complete_json") as mock_llm:
            mock_llm.return_value = mock_improved_resume_data
            improved_resume = await improve_resume(
                original_resume=json.dumps(mock_resume_data),
                job_description=mock_job_description,
                job_keywords=mock_job_keywords,
                language="en",
            )

            # Verify improvements were made
            assert (
                improved_resume["personalInfo"]["title"]
                != mock_resume_data["personalInfo"]["title"]
            )
            assert len(improved_resume["additional"]["technicalSkills"]) >= len(
                mock_resume_data["additional"]["technicalSkills"]
            )

        # Step 4: Calculate diff
        summary, changes = calculate_resume_diff(mock_resume_data, improved_resume)

        # Verify diff was calculated
        assert summary.total_changes > 0
        assert len(changes) > 0

        # Verify summary is properly structured
        assert isinstance(summary.skills_added, int)
        assert isinstance(summary.skills_removed, int)
        assert isinstance(summary.descriptions_modified, int)
        assert isinstance(summary.high_risk_changes, int)

    def test_confirm_request_schema(self, mock_resume_data):
        """Test the confirm request schema validation."""
        from app.schemas import ImproveResumeConfirmRequest

        request_data = {
            "resume_id": str(uuid4()),
            "job_id": str(uuid4()),
            "improved_data": mock_resume_data,
            "improvements": [
                {"suggestion": "Add Kubernetes experience", "lineNumber": 1},
                {"suggestion": "Highlight ML projects", "lineNumber": 2},
            ],
        }

        # Should not raise any exceptions
        request = ImproveResumeConfirmRequest(**request_data)
        assert request.resume_id == request_data["resume_id"]
        assert request.job_id == request_data["job_id"]
        assert len(request.improvements) == 2


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestTailoringEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_skills_list(self):
        """Test diff calculation with empty skills."""
        original = {"additional": {"technicalSkills": []}}
        improved = {"additional": {"technicalSkills": ["Python"]}}

        summary, changes = calculate_resume_diff(original, improved)

        assert summary.skills_added == 1
        assert summary.high_risk_changes == 1

    def test_missing_summary(self, mock_resume_data):
        """Test handling of missing summary."""
        original = {**mock_resume_data, "summary": ""}
        improved = {**mock_resume_data, "summary": "New summary added"}

        summary, changes = calculate_resume_diff(original, improved)

        summary_changes = [c for c in changes if c.field_type == "summary"]
        assert len(summary_changes) == 1
        assert summary_changes[0].change_type == "added"

    def test_malformed_description_items(self):
        """Test handling of malformed description data."""
        original = {
            "workExperience": [
                {"description": ["Valid item", None, 123, {"invalid": "object"}]}
            ]
        }
        improved = {"workExperience": [{"description": ["Valid item", "Another item"]}]}

        # Should not raise an exception
        summary, changes = calculate_resume_diff(original, improved)
        assert isinstance(summary, ResumeDiffSummary)

    @pytest.mark.asyncio
    async def test_improve_resume_handles_truncation(
        self, mock_resume_data, mock_job_keywords
    ):
        """Test that truncated responses (missing personalInfo) are handled gracefully."""
        truncated_data = {}  # Missing personalInfo entirely

        with patch("app.services.improver.complete_json") as mock_complete:
            mock_complete.return_value = truncated_data

            with pytest.raises(ValueError, match="Missing required section"):
                await improve_resume(
                    original_resume=json.dumps(mock_resume_data),
                    job_description="Test job",
                    job_keywords=mock_job_keywords,
                )


# =============================================================================
# Performance Tests
# =============================================================================


class TestTailoringPerformance:
    """Performance tests for tailoring operations."""

    def test_diff_calculation_performance(
        self, mock_resume_data, mock_improved_resume_data
    ):
        """Test that diff calculation is fast."""
        import time

        start = time.time()
        for _ in range(100):  # Run 100 times
            calculate_resume_diff(mock_resume_data, mock_improved_resume_data)
        duration = time.time() - start

        # Should complete 100 iterations in under 1 second
        assert duration < 1.0, f"Diff calculation too slow: {duration:.2f}s"

    def test_large_resume_handling(self):
        """Test handling of very large resumes."""
        # Create a large resume with many skills and experiences
        large_resume = {
            "personalInfo": {"name": "Test User"},
            "summary": "Summary " * 100,
            "workExperience": [
                {"id": i, "description": [f"Bullet {j}" for j in range(20)]}
                for i in range(50)  # 50 work experiences
            ],
            "additional": {"technicalSkills": [f"Skill {i}" for i in range(100)]},
        }

        # Should not raise an exception or timeout
        summary, changes = calculate_resume_diff(large_resume, large_resume)
        assert summary.total_changes == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
