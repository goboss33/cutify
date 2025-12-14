"""
Onboarding AI Service
Handles pitch analysis, tag extraction, and dynamic question generation.
"""
import json
import google.generativeai as genai
import os
from services.ai_logger import AILogger

# Configure Gemini
GENAI_API_KEY = os.getenv("GENAI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GENAI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp', generation_config={"response_mime_type": "application/json"})

async def analyze_pitch(pitch: str, category_slug: str, project_id: int = None) -> dict:
    """
    Analyze the user's pitch and extract relevant tags.
    Returns a list of detected tags/keywords.
    """
    if not pitch or len(pitch.strip()) < 5:
        return {"tags": [], "confidence": 0}

    prompt = f"""Tu es un assistant de production vidéo. Analyse ce pitch de projet et extrais les tags/mots-clés pertinents.

CATÉGORIE: {category_slug}
PITCH: "{pitch}"

Extrais les éléments suivants sous forme de tags courts (1-2 mots max):
- Marques/Produits mentionnés
- Lieux/Décors suggérés
- Personnages/Sujets
- Ambiances/Moods
- Styles visuels
- Thèmes

Réponds UNIQUEMENT en JSON valide:
{{
  "tags": ["tag1", "tag2", "tag3", ...],
  "detected_elements": {{
    "brands": [],
    "locations": [],
    "characters": [],
    "moods": [],
    "styles": [],
    "themes": []
  }},
  "confidence": 0.8
}}

Ne génère que 4-8 tags maximum, les plus pertinents uniquement."""

    try:
        log_id = AILogger.log_interaction(
            service="OnboardingAI",
            prompt=prompt,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)

        AILogger.update_interaction(log_id, response=result_text)
        return result

    except Exception as e:
        print(f"Error analyzing pitch: {e}")
        return {"tags": [], "confidence": 0, "error": str(e)}


async def generate_questions(
    pitch: str,
    category_slug: str,
    detected_tags: list,
    existing_answers: dict = None,
    project_id: int = None
) -> dict:
    """
    Generate dynamic follow-up questions based on the pitch and category.
    """
    existing_str = ""
    if existing_answers:
        existing_str = f"\nRÉPONSES DÉJÀ DONNÉES:\n{json.dumps(existing_answers, ensure_ascii=False)}"

    tags_str = ", ".join(detected_tags) if detected_tags else "aucun"

    # Category-specific hints
    category_hints = {
        "advertising": "Demande des précisions sur le produit, la marque, le message clé, et le call-to-action.",
        "social_content": "Demande le hook principal, le format préféré, et le style de contenu.",
        "cinematic": "Demande le genre, l'ambiance, et les personnages principaux.",
        "music": "Demande l'artiste, le mood du clip, et le style visuel souhaité.",
        "podcast": "Demande le sujet principal et le format (interview, solo, etc.).",
        "tutorial": "Demande le niveau de l'audience et les points clés à couvrir.",
        "motion_design": "Demande le style d'animation et les éléments à animer."
    }

    hint = category_hints.get(category_slug, "Pose des questions pertinentes pour ce type de projet.")

    prompt = f"""Tu es un assistant de pré-production vidéo. Génère 2-3 questions de suivi pour mieux comprendre le projet.

CATÉGORIE: {category_slug}
PITCH: "{pitch}"
TAGS DÉTECTÉS: {tags_str}
{existing_str}

DIRECTIVE: {hint}

Règles:
- Maximum 3 questions
- Questions courtes et directes
- Évite les questions dont la réponse est déjà dans le pitch
- Chaque question doit avoir un ID unique

Réponds UNIQUEMENT en JSON valide:
{{
  "questions": [
    {{"id": "q1", "question": "...", "type": "text", "placeholder": "..."}},
    {{"id": "q2", "question": "...", "type": "select", "options": ["opt1", "opt2"]}},
    {{"id": "q3", "question": "...", "type": "text", "placeholder": "..."}}
  ]
}}

Types possibles: "text", "select", "textarea"."""

    try:
        log_id = AILogger.log_interaction(
            service="OnboardingAI",
            prompt=prompt,
            project_id=project_id
        )

        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()
        result = json.loads(result_text)

        AILogger.update_interaction(log_id, response=result_text)
        return result

    except Exception as e:
        print(f"Error generating questions: {e}")
        return {"questions": [], "error": str(e)}
