# BrokerControl360

Démonstrateur local de contrôle et de pilotage pour les sociétés de bourse opérant sur le marché financier régional CEMAC. Les portefeuilles, ordres, contrôles et rapports sont fictifs. L’application ne se connecte ni à la BVMAC, ni à un dépositaire, ni à une banque.

> **Données locales et rôles fictifs.** Les données métier sont stockées dans IndexedDB sur ce navigateur et cette origine. Elles ne sont pas synchronisées. Le sélecteur de rôle illustre l’interface et ne constitue pas une authentification.

## Prérequis

- Node.js 20+ et npm
- Python 3.12+ (le projet a aussi été vérifié avec Python 3.14)
- Navigateur récent avec IndexedDB

## Installation

Depuis la racine du projet :

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

Les sources de marché restent dans `json/` et ne sont jamais modifiées. Les commandes `npm run dev` et `npm run build` génèrent d’abord `json_demo_2026/history.json`, puis préparent des copies statiques pour Vite dans `public/` (dossier ignoré par Git).

## Démarrage local

Lancer FastAPI et React dans deux terminaux à la racine du dépôt.

**Terminal 1 — API stateless :**

```bash
.venv/bin/uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 — application React :**

```bash
npm run dev
```

Ouvrir <http://127.0.0.1:5173> localement ou `http://ADRESSE_DU_SERVEUR:5173` depuis un poste distant. L’API de santé est disponible sur le port `8001` et sa documentation OpenAPI à `/docs`.

Les calculs API sont stateless. Si FastAPI est arrêté, les calculs locaux de démonstration restent utilisables dans le navigateur.

## Déploiement Vercel

Le frontend et l’API sont deux projets Vercel liés au même dépôt :

- **Frontend `brokercontrol360`** : racine du dépôt, framework Vite, build `npm run build`.
- **API `brokercontrol360-api`** : répertoire racine `backend/`, framework FastAPI.
- Dans les variables d’environnement Production et Preview du frontend, définir `VITE_API_URL` sur l’URL HTTPS du projet API (par exemple `https://brokercontrol360-api.vercel.app`).

L’API reste stateless ; les données métier continuent d’être conservées dans IndexedDB côté navigateur. Les règles CORS autorisent le domaine de production et les URLs Preview de ce frontend.

## Profils fictifs

| Profil | Usage du parcours |
| --- | --- |
| Risk manager — Alexandre Mbarga | Vue d’ensemble, portefeuille, contrôles, approbation maker-checker |
| Opérateur / back-office — Sophie Nguema | Ordres, exécution simulée et rapprochements |
| Gestionnaire — Marcelle Ewane | Portefeuilles et opérations de gestion |
| Compliance officer — Emmanuel Nguema | Risques, rapprochements, rapports et journal |
| Auditeur — Élise Mba | Consultation des données et de la piste d’audit |
| Direction — Patrice Ondo | Synthèse, marché et rapports |
| Administrateur — Équipe démo | Tous les modules et outils locaux |

Un auteur d’ordre ne peut pas approuver son propre ordre. Pour illustrer le contrôle, changez de profil dans le sélecteur de la barre latérale avant approbation.

## Parcours de démonstration

1. Ouvrir **Vue d’ensemble** puis consulter **Marché** : 19 bulletins de septembre 2026, cours, obligations, indice BVMAC-AS et valeurs liquidatives OPCVM.
2. Ouvrir un portefeuille synthétique et examiner la NAV, le cash, les positions et leur provenance.
3. Dans **Ordres**, saisir un petit achat d’obligation. Les contrôles d’espèces, de titres et de concentration sont enregistrés.
4. Sélectionner un autre profil fictif et approuver ou rejeter l’ordre.
5. Exécuter l’ordre approuvé : la transaction, le cash et la position sont mis à jour localement.
6. Dans **Rapprochements**, créer une session externe simulée, commenter et résoudre les écarts.
7. Générer un rapport de composition ou de limites. Télécharger HTML/CSV ou utiliser l’impression du navigateur pour créer un PDF.
8. Consulter les événements dans **Journal d’audit** et expliquer les notions dans **Wiki & méthodologie**.

## Données de marché et historique de démonstration

- `OBSERVED` : valeur importée d’un bulletin officiel présent dans `json/`.
- `INTERPOLATED` : valeur construite entre des observations ; usage graphique de démonstration.
- `SIMULATED` : trajectoire fictive déterministe, graine par défaut `360`, ancrée sur les cours observés.
- Les volumes non observés restent vides. Les obligations sont maintenues entre observations.
- Chaque bulletin observé de septembre et son volume restent importés tels quels. Les données générées sont placées séparément dans `json_demo_2026/`.
- Les valeurs simulées et seuils `TO_VERIFY` ne sont pas des données réglementaires ni des règles COSUMAF confirmées.

Recréer la série :

```bash
.venv/bin/python scripts/generate_demo_history.py
```

Options du générateur : `--seed 360`, `--start 2026-01-01`, `--end 2026-09-25`, `--output json_demo_2026`.

## Stockage, sauvegarde et réinitialisation

La base Dexie/IndexedDB est versionnée et migre automatiquement à l’ouverture. **Administration** propose l’export JSON complet, l’import d’une sauvegarde validée, le réimport idempotent des bulletins et la réinitialisation du jeu de démonstration. Le stockage est propre au navigateur/origine ; une sauvegarde est nécessaire pour déplacer les données.

Les copies préparées par les scripts d’installation ne remplacent pas les fichiers d’origine. Évitez toute donnée personnelle réelle, information KYC ou identifiant financier.

## Vérifications

```bash
npm run build
npm test
.venv/bin/pytest backend/tests
```

Les tests couvrent les migrations/repositories Dexie, l’import idempotent, la séparation des provenances, l’ordre et le contrôle maker-checker, l’exécution locale, la sauvegarde JSON et les calculs Pydantic.

## Arborescence

```text
src/                    React, TypeScript, Dexie et modules métier
backend/app/            API FastAPI stateless
backend/tests/          Tests des endpoints et calculs
json/                   Sources originales des bulletins (lecture seule)
json_demo_2026/         Historique 2026 démonstratif généré
scripts/                Générateur et préparation des ressources locales
```

Docker, CI/CD, persistance métier serveur et intégration de marché réel restent hors périmètre.
