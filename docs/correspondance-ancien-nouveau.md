# Correspondance ancien serveur → nouvelle API

Chaque route de l'ancien serveur (`maison-adoration-server`, MongoDB) et ce qu'elle est devenue.

## Repris (utilisé par le site)

| Ancien | Nouveau |
|---|---|
| `POST /register`, `POST /login`, `GET /me` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `GET /stats` | `GET /stats` (compte corrigé des contenus) |
| `GET /settings` (exposait le jeton FlexPay) | `GET /settings` (devise, paiement actif, clé publique push) |
| `GET /users/page/:n` | `GET /users?page=&search=&role=` |
| `POST /users/add-user`, `add-admin` | `POST /users` (`role: user` ou `admin`) |
| `POST /users/add-super-admin` | `PUT /users/:id/role` (super-admin) |
| `PUT /users/:id`, `PUT /users/password/:id`, `DELETE /users/:id` | `PUT /users/:id`, `PUT /users/:id/password`, `DELETE /users/:id` |
| `POST /users/addcourse` | `POST /contents/:id/enrollments` |
| `GET /users/781227` (publique : e-mails de tous) | `GET /users/export.csv` (admin) |
| `GET /webinars`, `/courses`, `/ateliers`, `/page/:n` | `GET /contents?type=&search=&page=` |
| `GET /webinars/mycourses` | `GET /contents/mine` |
| `GET /webinars/:id` | `GET /contents/:id` |
| `GET /webinars/participants/:id` (publique, renvoyait les mots de passe chiffrés) | `GET /contents/:id/participants` (admin) |
| `POST /webinars`, `POST /webinars/with-pdf` | `POST /contents` |
| `PUT /webinars/:id`, `PUT /webinars/poster/:id`, `DELETE /webinars/:id` | `PUT /contents/:id`, `PUT /contents/:id/poster`, `DELETE /contents/:id` |
| `GET /webinars/notify-client/:id`, `POST /sms/send`, `POST /email/send` | `POST /contents/:id/notify` `{channel: push \| sms \| email}` |
| `POST /pushnotifs` | `POST /push-subscriptions` |
| `POST /flexpay/pay` | `POST /payments/flexpay` |
| `POST /flexpay/verify` (faisait confiance au contenu reçu) | `POST /payments/flexpay/callback` (revérifie auprès de FlexPay) |
| — | `GET /payments/:id` (suivi du paiement par le site) |
| Socket.io `onPaiementSuccess` (diffusé à tout le monde, jamais écouté par le site) | remplacé par `GET /payments/:id` |

## Supprimé volontairement

| Ancien | Raison |
|---|---|
| `POST /hash`, `POST /testpwd`, `GET /sms/test`, `GET /sms/test-bulk`, `GET /email/test`, `GET /flexpay/notify` | Routes de test |
| `POST /flexpay/verify-paiement` | Faille : donnait un cours payant sans paiement |
| `GET /webinars/user/:id` | Ne fonctionnait pas (champ inexistant) |
| `/categories`, `/orders` (+ `student-order`), `PUT /settings` | Boutique héritée d'un autre projet, jamais utilisée par le site. Données sauvegardées en JSON par le script de migration. À reconstruire proprement pour la future boutique Mobile Money. |
| `/reports` | Jamais utilisé par le site. Données sauvegardées en JSON. |
| `/downloadscount` | Jamais utilisé (liste de livres vide). Données sauvegardées en JSON. |
