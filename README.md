# MongoArchitect AI

AI-powered MongoDB schema designer with intelligent refinements, version tracking, and comprehensive schema analysis.

## ✨ Features

- **AI-Powered Schema Generation** - Uses Groq LLM to generate optimal MongoDB schemas from natural language
- **Intelligent Refinements** - Modify schemas using conversational requests (e.g., "add address type for user")
- **Version History** - Track all schema iterations with full parent-child relationships
- **Smart Diff Detection** - Visual comparison between schema versions with field-level changes
- **Schema Metrics** - Real-time analysis of collections, fields, depth, and complexity
- **Interactive Chat** - Conversational interface for schema design and questions
- **Export Functionality** - Download schemas as JSON files
- **JWT Authentication** - Secure user accounts and schema ownership

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + React Router
- **Backend:** FastAPI (Python 3.8+)
- **Database:** MongoDB Atlas (via Motor async driver)
- **AI Engine:** Groq (llama-3.1-8b-instant)
- **Auth:** JWT tokens

## Project Structure

- frontend/ - React app
- backend/ - FastAPI app

## Setup

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
copy .env.example .env
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## 💡 Usage Examples

### Creating a Schema
1. Navigate to Dashboard
2. Enter your requirement: *"I want an e-commerce app with users, products, orders, and reviews"*
3. Select workload type (balanced, read-heavy, or write-heavy)
4. View generated schema with decisions and warnings

### Refining a Schema
1. Open any schema from History
2. Use the refinement box at the bottom:
   - *"add delivery timeline to orders"*
   - *"remove zip from user address"*
   - *"add address type field (home, work, or other)"*
3. View changes in the diff section
4. Navigate between versions using Previous/Next buttons

### Understanding Schema Details
- **Original Requirement:** What you initially asked for
- **Refinement History:** All modifications made over time
- **Metrics:** Quick overview of schema complexity
- **Decisions:** Why collections are structured this way
- **Indexes:** Performance optimization recommendations
- **Warnings:** Potential scalability issues

## Environment Variables

Create `backend/.env` based on `backend/.env.example`.

```env
MONGODB_URI=your_mongodb_atlas_uri
DATABASE_NAME=mongoarchitect
JWT_SECRET=replace_with_secure_random_value
ALLOWED_ORIGINS=http://localhost:5173
GROQ_API_KEY=your_groq_api_key_here
```

**Getting API Keys:**
- MongoDB: [Create free cluster at MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
- Groq: [Get free API key at Groq Console](https://console.groq.com/)

## Logos

Place your logos in:

- `frontend/public/logo-square.png`
- `frontend/public/logo-horizontal.png`

The UI will automatically show them when present.

## 🚀 Key Capabilities

### Schema Generation
- Analyzes natural language requirements
- Detects entities, relationships, and access patterns
- Generates optimized MongoDB schemas with decisions and warnings
- Supports different workload types (balanced, read-heavy, write-heavy)

### Schema Refinement
- Conversational modifications: "add email to orders", "remove zip from user address"
- AI regenerates entire schema with updated decisions and warnings
- Supports nested field operations and enum detection
- Maintains full version history with parent-child tracking

### Schema Analysis
- **Metrics:** Collection count, field count, nesting depth
- **Decisions:** Why each collection is separate vs embedded
- **Indexes:** Recommended indexes with specific reasons
- **Warnings:** Scalability concerns and performance tips
- **Diff View:** Field-level changes between versions

## 📸 Screenshots

### Schema Detail View
- Original requirement display
- Refinement history timeline
- Schema metrics with delta indicators
- Interactive version navigation
- Schema JSON with syntax highlighting
- Detailed decisions, explanations, and confidence scores

## Notes

- Powered by Groq's LLM for intelligent schema reasoning
- All schemas are stored per-user in MongoDB with version tracking
- Refinements create new versions while preserving history
