
---
title: Efootball Arena API
emoji: ⚽
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---



<div align="center">

# ⚽ eFootball Arena

### Plateforme complète de gestion de ligues eFootball entre amis

*Standings automatiques • Validation de résultats par preuve • Bot WhatsApp • Assistant IA • Notifications push*

[![Live Demo](https://img.shields.io/badge/demo-live-success?style=for-the-badge)](https://efootball-arena.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Made with Love](https://img.shields.io/badge/made%20with-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge)](#)

</div>

<br/>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=flat-square&logo=huggingface&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp%20Bot-25D366?style=flat-square&logo=whatsapp&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle%20Cloud-F80000?style=flat-square&logo=oracle&logoColor=white)
![Mistral AI](https://img.shields.io/badge/Mistral%20AI-FA520F?style=flat-square&logo=mistralai&logoColor=white)

</div>

---

## 📖 Sommaire

- [À propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Architecture](#-architecture)
- [Démarrage rapide](#-démarrage-rapide)
- [Variables d'environnement](#-variables-denvironnement)
- [Structure du projet](#-structure-du-projet)
- [Bot WhatsApp](#-bot-whatsapp)
- [Notifications push](#-notifications-push)
- [Roadmap](#-roadmap)
- [Contribuer](#-contribuer)
- [Auteur](#-auteur)
- [Licence](#-licence)

---

## 🎯 À propos

**eFootball Arena** est une plateforme full-stack conçue pour digitaliser la gestion d'une ligue eFootball entre amis : calendrier de matchs, classement en temps réel, soumission de résultats avec preuve (capture d'écran), validation par un administrateur, statistiques par joueur, et un assistant IA qui donne des conseils personnalisés à chaque participant.

Le projet va au-delà du simple site web : il intègre un **bot WhatsApp** permettant aux joueurs de soumettre leurs résultats directement depuis leur groupe WhatsApp, sans jamais ouvrir l'application, ainsi qu'un système de **notifications push** natives pour alerter l'administrateur en temps réel.

## ✨ Fonctionnalités

| Catégorie | Détails |
|---|---|
| 🏆 **Ligues & Classement** | Création de ligues, calendrier automatique, classement mis à jour en direct |
| 📸 **Validation par preuve** | Soumission de résultats avec capture d'écran obligatoire, revue admin avant validation |
| 🤖 **Bot WhatsApp** | Flow conversationnel complet — capture + `/matche` → sélection du match → score → claim automatique |
| 🔔 **Notifications push** | Alerte navigateur en temps réel à l'admin dès qu'un claim est soumis, clic direct vers le dashboard |
| 🧠 **Assistant IA** | Conseils tactiques personnalisés générés pour chaque joueur selon sa position au classement |
| 🔐 **Authentification** | JWT + connexion Google OAuth, rôles admin/utilisateur |
| 📊 **Statistiques** | Historique des matchs, trophées, performances par joueur |

## 🛠️ Stack technique

<table>
<tr>
<td valign="top" width="50%">

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Déployé sur Vercel

</td>
<td valign="top" width="50%">

**Backend**
- FastAPI (Python)
- PostgreSQL via Supabase
- SQLAlchemy ORM
- Déployé sur Hugging Face Spaces

</td>
</tr>
<tr>
<td valign="top">

**Bot & Automatisation**
- Node.js + Baileys (WhatsApp)
- Hébergé sur Oracle Cloud (VM Always Free)
- Géré en process via PM2

</td>
<td valign="top">

**IA & Notifications**
- Mistral AI (conseils tactiques)
- Web Push API (VAPID)
- Service Worker natif

</td>
</tr>
</table>

## 🏗️ Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   Frontend       │◄──────►│    Backend API    │◄──────►│   PostgreSQL      │
│   Next.js        │  REST  │    FastAPI         │  ORM   │   (Supabase)      │
│   (Vercel)        │        │   (Hugging Face)   │        │                    │
└─────────────────┘        └────────┬─────────┘        └──────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
             ┌──────▼──────┐   ┌───────▼───────┐   ┌──────▼──────┐
             │ Bot WhatsApp │   │  Mistral AI    │   │  Web Push   │
             │  (Baileys)   │   │  (conseils)    │   │  (VAPID)    │
             │ Oracle Cloud │   └────────────────┘   └─────────────┘
             └──────────────┘
```

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- Python 3.11+
- Un projet Supabase (PostgreSQL)

### Installation

```bash
git clone https://github.com/H-LAPRIME/Arena.git
cd Arena
```

**Backend**
```bash
cd backend
pip install -r requirements.txt --break-system-packages
cp .env.example .env   # renseigne tes variables (voir ci-dessous)
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

**Bot WhatsApp** *(optionnel)*
```bash
cd whatsapp-bot
npm install
cp config.example.json config.json   # renseigne backendUrl, leagueId, botSecret...
node bot.js
```

## 🔑 Variables d'environnement

<details>
<summary><strong>Backend (.env)</strong></summary>

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (Supabase pooler) |
| `JWT_SECRET` | Secret de signature des tokens |
| `MISTRAL_API_KEY` | Clé API pour l'assistant IA |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Stockage des captures d'écran |
| `BOT_SHARED_SECRET` | Authentifie les appels du bot WhatsApp |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notifications push |

</details>

<details>
<summary><strong>Bot WhatsApp (config.json)</strong></summary>

| Clé | Description |
|---|---|
| `backendUrl` | URL du backend déployé |
| `leagueId` | UUID de la ligue à surveiller |
| `groupName` | Nom exact du groupe WhatsApp |
| `botSecret` | Doit correspondre à `BOT_SHARED_SECRET` |
| `lidMap` | Correspondance LID WhatsApp ↔ numéro réel |

</details>

## 📁 Structure du projet

```
Arena/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── models/          # Modèles SQLAlchemy
│   │   ├── routers/         # Endpoints (auth, leagues, claims, bot, push...)
│   │   ├── schemas/         # Schémas Pydantic
│   │   └── utils/           # Utilitaires (push, etc.)
│   └── scripts/             # Migrations & scripts d'admin
├── frontend/                 # Application Next.js
│   ├── src/app/              # Pages (App Router)
│   └── public/               # Assets statiques + service worker
└── whatsapp-bot/              # Bot Node.js (Baileys)
    └── bot.js
```

## 🤖 Bot WhatsApp

Le bot permet à n'importe quel joueur de soumettre un résultat sans quitter WhatsApp :

1. **Capture d'écran** envoyée avec `/matche` en légende
2. Le bot répond avec la **liste des matchs en attente** du joueur
3. Le joueur **répond avec le numéro** du match concerné
4. Le joueur **envoie le score** (ex: `3-1`)
5. Le claim est automatiquement créé côté plateforme, **en attente d'approbation admin**

Le bot tourne 24/7 sur une VM Oracle Cloud (tier gratuit), géré via PM2 pour un redémarrage automatique.

## 🔔 Notifications push

Dès qu'un claim est soumis (depuis le site **ou** depuis WhatsApp), l'administrateur reçoit une **notification navigateur native** — même application fermée — qui l'amène directement à la page de validation d'un simple tap.

## 🗺️ Roadmap

- [ ] Gestion multi-ligues avec activation du bot depuis le dashboard admin
- [ ] Boutons d'approbation directement depuis la notification push
- [ ] Application mobile dédiée
- [ ] Statistiques avancées (heatmaps de performance, historique head-to-head)

## 🤝 Contribuer

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Crée ta branche (`git checkout -b feature/ma-feature`)
3. Commit tes changements (`git commit -m 'Ajout de ma feature'`)
4. Push la branche (`git push origin feature/ma-feature`)
5. Ouvre une Pull Request

## 👤 Auteur

<div align="center">

**HIDA MOUAD**

Étudiant en Informatique — II-BDCC/GLSID, ENSET Mohammedia, Université Hassan II de Casablanca

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/H-LAPRIME)

</div>

## 📄 Licence

Ce projet est sous licence MIT — voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">

*Développé avec passion pour digitaliser les ligues eFootball entre amis* ⚽

</div>
