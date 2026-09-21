# Syntapse Backend

The Syntapse backend powers the multi-agent AI engine, orchestrating the software development lifecycle from ideation to implementation. It is built using **FastAPI** and utilizes **Cognee** for a robust, persistent memory graph.

## Prerequisites

Before running the backend, you must have the following installed and running:

1. **Python 3.10+**
2. **Ollama (Running Locally)**
   - The backend uses local LLMs for specific tasks (like the Execution Tracker evaluation).
   - Install Ollama from [ollama.com](https://ollama.com/).
   - Pull the required model by running: `ollama run qwen2.5-coder:3b`
   - Ensure the Ollama server is running (default is usually `http://localhost:11434`).
3. **Gemini API Key**
   - The core multi-agent orchestration is powered by Google's Gemini.
   - You will need a valid `GEMINI_API_KEY`.

## Setup Instructions

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Set up a Virtual Environment (Recommended):**
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On Mac/Linux:
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   - Create a `.env` file in the root `Hangover` directory (one level up from this folder).
   - Add your API keys and configuration:
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     # If your local Ollama is on a different port, specify it here
     # OLLAMA_BASE_URL=http://localhost:11434
     ```

## Running the Server

Start the FastAPI backend using `uvicorn` from the **root directory of the project**:

```bash
# Go back to the root directory
cd ..

# Run the backend
uvicorn backend.main:app --reload --host 0.0.0.0
```

The backend API will be available at `http://localhost:8000`. 
WebSocket connections for the live Neural Canvas stream will connect via `/ws/projects/...`.

## Architecture Highlights
- **FastAPI**: Handles REST endpoints and WebSockets for real-time frontend updates.
- **Cognee**: Acts as the memory layer, allowing agents to persist their thoughts and context to a local graph database without context window limits.
- **LiteLLM**: Used to standardize AI calls across Gemini and local Ollama models.
