"""Document parsing service using markitdown and LLM."""

import tempfile
from pathlib import Path
from typing import Any

from markitdown import MarkItDown

from app.llm import complete_json
from app.prompts import PARSE_RESUME_PROMPT
from app.prompts.templates import RESUME_SCHEMA_EXAMPLE
from app.schemas import ResumeData


async def parse_document(content: bytes, filename: str) -> str:
    """Convert PDF/DOCX to Markdown using markitdown.

    Args:
        content: Raw file bytes
        filename: Original filename for extension detection

    Returns:
        Markdown text content
    """
    suffix = Path(filename).suffix.lower()

    # Write to temp file for markitdown
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        md = MarkItDown()
        result = md.convert(str(tmp_path))
        return result.text_content
    finally:
        tmp_path.unlink(missing_ok=True)


async def parse_resume_to_json(markdown_text: str) -> dict[str, Any]:
    """Parse resume markdown to structured JSON using LLM.

    Args:
        markdown_text: Resume content in markdown format

    Returns:
        Structured resume data matching ResumeData schema
    """
    prompt = PARSE_RESUME_PROMPT.format(
        schema=RESUME_SCHEMA_EXAMPLE,
        resume_text=markdown_text,
    )

    result = await complete_json(
        prompt=prompt,
        system_prompt="You are a JSON extraction engine. Output only valid JSON, no explanations.",
    )

    # Fix common LLM output issues before validation
    result = _fix_resume_data(result)

    # Validate against schema
    validated = ResumeData.model_validate(result)
    return validated.model_dump()


def _fix_resume_data(data: dict[str, Any]) -> dict[str, Any]:
    """Fix common issues in LLM-generated resume data."""
    if not data:
        return data

    # Fix custom sections - convert string items to objects
    if "customSections" in data and data["customSections"]:
        for section_name, section_data in data["customSections"].items():
            if isinstance(section_data, dict) and "items" in section_data:
                items = section_data["items"]
                if isinstance(items, list):
                    fixed_items = []
                    for item in items:
                        if isinstance(item, str):
                            # Convert string to object with title
                            fixed_items.append({"title": item})
                        elif isinstance(item, dict):
                            # Ensure id field exists
                            if "id" not in item:
                                item["id"] = len(fixed_items) + 1
                            fixed_items.append(item)
                    section_data["items"] = fixed_items

    return data
