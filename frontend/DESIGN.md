---
version: alpha
name: KotBis
description: Fenêtres de contribution sur la carte des bus de Maurice.
colors:
  primary: "#2ed6a1"
  ink: "#17243a"
  muted: "#5c6c83"
  surface: "#ffffff"
  accent: "#08795c"
typography:
  sans:
    fontFamily: "var(--ion-font-family, system-ui, sans-serif)"
rounded:
  DEFAULT: "16px"
  dialog: "28px"
spacing:
  panel: "24px"
  gap: "12px"
components:
  button: {}
  dialog: {}
---
# KotBis — contributions

## Overview
Interface produit en français pour consulter les avis sur les bus de Maurice.
Reprise de la carte blanche arrondie et des boutons verts du prototype fourni par l'utilisateur.
La carte Leaflet et la page Favoris du dépôt sont conservées.
Source canonique des tokens : `src/theme/community.scss`, chargée par `src/global.scss`.
Ce document décrit les écrans de contribution, pas une refonte de l'application.

## Colors
Fond blanc, texte sombre, vert pour les actions et vert foncé pour les accents.
Les fenêtres conservent leur palette claire même si le thème système est sombre.

## Typography
Police Ionic existante, titres 22px, informations secondaires 12 à 13px.
Les noms et les textes longs doivent pouvoir revenir à la ligne.

## Layout
Fenêtre centrée de 440px maximum, marges latérales de 12px minimum, défilement interne.
La fenêtre native dialog rend la carte inactive et gère le focus modal.

## Elevation & Depth
Fond assombri et ombre de fenêtre, pas d'ombre sur chaque avis.

## Shapes
Fenêtres arrondies à 28px et actions à 16px. Avatar circulaire.

## Components
Le composant CommunityDialogComponent porte le titre, le retour et la fermeture.
Les liens de navigation gardent leur sémantique de lien, avec une présentation de bouton.
Focus visible, cibles de 44px minimum et absence d'animation décorative.

## Do's and Don'ts
Préserver la carte réelle du dépôt. Signaler les données de démonstration.
Ne pas présenter le stockage en mémoire comme une API connectée.
