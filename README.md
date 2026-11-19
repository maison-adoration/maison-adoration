# Maison d'Adoration pour les Nations (M.A.N.)

Site web et API de la Maison d'Adoration pour les Nations, Lubumbashi.

```
maison-adoration/
├── backend/    API Node.js (Express) + PostgreSQL
├── frontend/   Site web SvelteKit 2 + Svelte 5 + Tailwind (site statique)
└── docs/       Contenu prévu pour le site, correspondance ancien → nouveau
```

## Démarrer en local

Prérequis : Node.js 20 ou plus, PostgreSQL 14 ou plus, Yarn 1.

Après une mise à jour du dépôt (`git pull`), relancer `npm install` dans `backend` et `yarn install` dans `frontend`
si leurs fichiers `package.json` ont changé, puis `npm run db:migrate` dans `backend`.

### 1. API (`backend/`)

```bash
cd backend
cp .env.example .env          # puis remplir DATABASE_URL et JWT_SECRET au minimum
npm install
npm run db:migrate            # crée les tables
npm run create-super-admin -- votre@email.com "Votre Nom"
npm run dev                   # http://localhost:5000
```

### 2. Site (`frontend/`)

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:5000
yarn install
yarn dev                      # http://localhost
yarn build && yarn preview    # version de production, http://localhost:4173
```

Pour que le site local puisse appeler l'API, son adresse doit figurer dans `CORS_ORIGINS` du backend.

## Tests

```bash
cd backend
npm test                                           # API (base PostgreSQL de test)
TEST_MONGO_URI=mongodb://127.0.0.1:27017/x npm test  # + test de la migration MongoDB
```

`TEST_DATABASE_URL` choisit la base de test (par défaut `postgresql://postgres@localhost:5432/man_test`). Elle est **entièrement effacée** à chaque lancement.

## Migrer les données de l'ancien site (MongoDB → PostgreSQL)

À faire une seule fois, après avoir créé la base PostgreSQL de production :

```bash
cd backend
MONGO_URI="mongodb+srv://…ancienne base…" DATABASE_URL="postgresql://…" npm run migrate-from-mongo -- --dry-run   # vérification
MONGO_URI="mongodb+srv://…ancienne base…" DATABASE_URL="postgresql://…" npm run migrate-from-mongo               # migration réelle
```

- Les inscrits gardent leur mot de passe et leurs contenus achetés.
- Les identifiants sont conservés : les anciens liens restent valides.
- Les comptes en double (même e-mail) et les contenus invalides sont signalés et ignorés.
- Les anciennes données de boutique (commandes, articles…) sont sauvegardées en JSON dans `backend/mongo-backup/` (non versionné : contient des données personnelles).
- Le script peut être relancé sans créer de doublons.

## Déploiement

**API** (ex. Render, service Web Node) :
- Dossier racine : `backend`
- Build : `npm install && npm run db:migrate`
- Démarrage : `npm start`
- Variables d'environnement : voir `backend/.env.example` (`NODE_ENV=production`, `DATABASE_SSL=true` pour une base hébergée).

**Site** (site statique) :
- Dossier racine : `frontend`
- Build : `yarn install && yarn build` → dossier `build/`
- Variable : `VITE_API_URL` = adresse publique de l'API.

## Sécurité

- Aucun secret dans le code : tout passe par les variables d'environnement (`.env`, jamais versionné).
- Les clés présentes dans l'ancien code (Twilio, Cloudinary, Postmark, VAPID, FlexPay, MongoDB, JWT) **doivent être régénérées** chez chaque fournisseur : elles ont circulé dans les anciens dépôts.
- L'accès aux contenus payants est vérifié par le serveur ; un paiement n'est validé qu'après confirmation directe auprès de FlexPay.

## API — routes principales

| Méthode | Route | Accès |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` | connecté |
| GET | `/settings`, `/stats`, `/health` | public |
| GET | `/contents?type=&search=&page=` | public (lien caché sans accès) |
| GET | `/contents/:id`, `/contents/titles` | public |
| GET | `/contents/mine` | connecté |
| POST/PUT/DELETE | `/contents…` | admin |
| GET | `/contents/:id/participants` | admin |
| POST | `/contents/:id/enrollments` | admin (accès manuel par e-mail) |
| POST | `/contents/:id/notify` `{channel: email\|sms\|push}` | admin |
| POST | `/payments/flexpay` | connecté |
| GET | `/payments/:id` | propriétaire |
| POST | `/payments/flexpay/callback` | FlexPay (revérifié) |
| GET/POST | `/users` | admin |
| GET | `/users/export.csv` | admin |
| PUT | `/users/:id`, `/users/:id/password` | soi-même (ou rôle supérieur) |
| PUT | `/users/:id/role` | super-admin |
| POST | `/push-subscriptions` | public |
| GET | `/sections?page=maison\|ministeres\|extensions\|dons` | public (publiées) / admin (toutes) |
| POST/PUT/DELETE | `/sections…` | admin |
| POST | `/kids-registrations` | public (formulaire Man Kids) |
| GET/PUT/DELETE | `/kids-registrations…` | admin |
| GET/POST/PUT/DELETE | `/media/…` (sermons, series, gallery, photos, podcasts, press, streams, uploads, dashboard) | équipe média, admin, super-admin |
| GET/POST | `/media/public/…` (overview, albums/:id, press/:id, compteurs de vues) | public (publié uniquement) |

## Équipe média

Le rôle **« Équipe média »** (donné par un super-admin dans Administration → Utilisateurs) ouvre l'onglet **Médias** :
tableau de bord, sermons et séries, galerie photo, podcasts, communiqués de presse et directs YouTube/Facebook
(programmer, lancer, terminer, ajouter la rediffusion). Les visiteurs les retrouvent sur `/mediatheque` et `/live`.
Module réécrit d'après le rôle « média » du projet MAN Platform ; le studio et les cours en direct (LiveKit) n'y sont pas repris.

## Pages du site modifiables sans code

Les pages **Maison**, **Ministères**, **Extensions** et **Dons** sont composées de sections modifiables dans
**Administration → Pages du site** : titre, texte, image, informations pratiques (adresse, numéros…), ordre,
publication. Les sections encore vides (Notre culture, Nos croyances, Jeunesse, Les sœurs, Man Worship, MAN Kolwezi,
coordonnées de dons…) sont créées en brouillon : elles n'apparaissent sur le site qu'une fois remplies et publiées.
