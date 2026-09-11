# ⚡ GridXD — AI Icon System Generator

> SaaS product for extracting, generating and exporting coherent icon systems from visual references with AI-assisted image processing.

**Status:** 🟡 Active Development  ·  **Version:** 2.0.0  ·  **Stack:** React · Vite · TypeScript · FastAPI  
**Developer ecosystem:** RulloLabs

---

## 👋 About

**GridXD** is a product-design tool built around a simple idea: reduce repetitive work when turning an existing visual language into a reusable icon system.

The project combines a modern web dashboard, image-processing services and AI-assisted visual analysis into a structured SaaS workflow.

## ✨ Highlights

- 🧩 Extract and structure icon assets from visual references
- 🤖 AI-assisted visual/style analysis
- 🖼️ Image-processing pipeline
- ✏️ SVG-oriented output workflow
- 📦 Asset packaging and export
- ☁️ Storage, authentication and subscription integration points
- ⚡ Modern React/Vite product interface

## 🧠 What this project demonstrates

**Product Design → UX/UI → AI Workflow → Image Processing → SaaS Architecture**

GridXD is one of the strongest examples in the RulloLabs portfolio of connecting interface design with a real technical pipeline.

## 🛠️ Tech Stack

**Frontend**
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Lucide React

**Backend / Processing**
- Python
- FastAPI
- OpenCV
- rembg
- ImageTracer

**AI & Infrastructure**
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

## 📁 Structure

```text
gridxd/
├── src/              # React application
├── backend/          # FastAPI processing service
├── supabase/         # Database / edge functions
├── public/           # Static assets
└── .github/          # Automation / deployment workflows
```

## 🚀 Run locally

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

## 🔗 Links

**LinkedIn:** https://www.linkedin.com/in/jordisanchez-design  
**GitHub organisation:** https://github.com/RulloLabs

> Live demos and screenshots should only be linked when they match the current production state.

## 📊 Status

**Active Development** — the repository contains the frontend application and documented service architecture for the GridXD workflow.

## 💼 Professional value

GridXD demonstrates experience across:

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

Never commit API keys or secrets. Use environment variables for Supabase, Stripe, AI and deployment credentials.

## ©️ RulloLabs

Created and maintained by **RulloLabs**.
