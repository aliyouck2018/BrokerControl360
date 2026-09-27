# Guide de démonstration commerciale

## Message de présentation

BrokerControl360 centralise une vue de marché, des portefeuilles fictifs et une piste de contrôle locale pour illustrer le parcours d’une société de bourse. Il complète les systèmes de marché et de conservation existants ; il ne les remplace pas.

## Parcours recommandé (8–10 minutes)

### 1. Marché et traçabilité

Afficher le dashboard, puis le référentiel. Montrer l’ISIN, le dernier cours, l’indice et les badges de provenance. Souligner que les volumes nuls des bulletins sont conservés et que `SIMULATED` est filtrable séparément.

### 2. Portefeuille et risque

Ouvrir le portefeuille obligataire. Expliquer la somme des positions et du cash dans la NAV, le coupon couru indicatif et la distinction entre cours observé et quantité détenue fictive. Montrer l’exposition par émetteur et indiquer que les seuils `TO_VERIFY` sont des paramètres de démonstration.

### 3. Ordre et séparation des tâches

Créer un petit ordre acheteur. Lire les contrôles avant enregistrement. Laisser le profil créateur actif pour démontrer que son approbation est refusée. Changer de profil, approuver et exécuter l’ordre simulé. Vérifier la transaction et le solde.

### 4. Rapprochement et rapport

Créer une session de rapprochement, résoudre une anomalie, puis ouvrir le journal. Générer le rapport et montrer la date d’arrêté, les sources, les statuts de provenance et l’avertissement de démonstration. L’impression du navigateur permet de choisir une destination PDF.

### 5. Wiki et méthodologie

Rechercher `OPCVM`, `FCP`, `COSUMAF` ou `duration`. Présenter le résumé simple, la définition professionnelle, l’exemple, la formule éventuelle, la limite et la source.

## Points de langage

- Les profils sont fictifs et stockés localement ; aucune authentification n’est simulée comme mesure de sécurité.
- Les ordres ne sont jamais transmis et les contreparties n’existent pas.
- Les données provenant de `json/` sont séparées des historiques générés dans `json_demo_2026/`.
- Les exports sont des modèles de démonstration, non des formulaires réglementaires validés.
- Aucune donnée personnelle réelle n’est à saisir.
