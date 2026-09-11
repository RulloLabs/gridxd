# ⚡ GridXD — AI Icon System Generator

> SaaS platform for extracting, generating and exporting coherent icon systems from visual references using AI.

**Status:** 🟡 Active Development  |  **Version:** 2.0.0  |  **Stack:** React · Vite · TypeScript · FastAPI

---

## 📌 What is GridXD?

GridXD is a product-design tool focused on turning mockups and visual references into reusable icon assets and structured SVG output.

It combines a modern web dashboard with an image-processing backend and AI-assisted visual analysis.

## 🎯 Problem it addresses

Creating a consistent icon set from an existing visual language often requires repetitive manual work. GridXD explores an automated workflow for analysing a reference, extracting visual characteristics and generating or exporting reusable assets.

## 🛠️ What I built

- Product and interface design for the GridXD workflow.
- React/Vite dashboard architecture.
- Image-processing pipeline integration.
- AI-assisted style extraction and SVG generation.
- Asset packaging and export workflows.
- Integration points for authentication, storage and subscriptions.

## 💻 Tech Stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Lucide React

### Backend
- Python
- FastAPI
- OpenCV
- rembg
- ImageTracer

### AI & Services
- Gemini-based visual analysis
- Supabase / PostgreSQL
- Supabase Storage
- Stripe
- Google Cloud Run
- Vercel

## 🏗️ Architecture

```text
Reference / Mockup
        ↓
React + Vite Dashboard
        ↓
API Layer
        ↓
FastAPI Processing Engine
        ↓
Image Processing + AI Analysis
        ↓
SVG / Asset Output
        ↓
Storage / Export
```

## 📁 Project Structure

```text
gridxd/
├── src/              # React application
├── backend/          # FastAPI processing service
├── supabase/         # Database / edge functions
├── public/           # Static assets
└── .github/          # Automation / deployment workflows
```

## 🚀 Run Locally

```bash
git clone https://github.com/RulloLabs/gridxd.git
cd gridxd
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
```

## 🖼️ Visualisation & Demo

The visual presentation of GridXD is part of the RulloLabs digital-product portfolio.

🌐 **https://jorgesanchez.studio**

> Screenshots and live demo links should be kept aligned with the current production state.

## 📊 Project Status

**Active Development** — the repository currently contains the frontend application and documented service architecture.

## 💼 Professional Value

GridXD demonstrates the connection between:

- Product design
- UX/UI
- AI-assisted workflows
- Image processing
- SaaS architecture
- Frontend and backend development

## 🔭 Roadmap

- [ ] Broader visual extraction workflows
- [ ] Improved export tooling
- [ ] Expanded Figma integration
- [ ] CLI workflow refinement
- [ ] Further AI-assisted design automation

## 🔐 Security

Do not commit API keys or secrets. Use environment variables for Supabase, Stripe, AI and deployment credentials.

## ©️ RulloLabs

Created and maintained by **RulloLabs**.
