# FIFA Penalty Premium Prediction

Plateforme de prédiction intelligente pour FIFA Penalty, basée sur les APIs de 1xbet.ci avec un système d'analyse et de recommandation de paris.

## 🎯 Fonctionnalités

- **Affichage des ligues FIFA Penalty** - Liste complète des championnats disponibles
- **Matchs en temps réel** - Tous les matchs à venir avec cotes
- **Système de prédiction intelligent** - Analyse basée sur:
  - Forme récente des équipes
  - Statistiques offensives/défensives
  - Avantage domicile
  - Historique des confrontations
- **Recommandations de paris** - Suggestions avec:
  - Type de pari recommandé
  - Confiance du modèle
  - Niveau de risque
  - Valeur attendue (Expected Value)
- **Interface moderne** - Design responsive avec TailwindCSS

## 🚀 Démarrage

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) avec votre navigateur.

## 📁 Structure du projet

```
src/
├── app/
│   ├── page.tsx              # Page d'accueil (ligues + matchs)
│   ├── league/[id]/page.tsx # Page détail ligue
│   └── match/[id]/page.tsx  # Page détail match + prédiction
├── lib/
│   ├── api.ts               # Service API + données mockées
│   └── prediction.ts        # Moteur de prédiction
└── types/
    └── index.ts             # Types TypeScript
```

## 🧠 Algorithme de prédiction

Le système utilise plusieurs facteurs pour générer des prédictions:

1. **Force de l'équipe** - Calculée à partir du taux de victoire, différence de buts et forme récente
2. **Avantage domicile** - +15% de probabilité pour l'équipe à domicile
3. **Expected Value (EV)** - Utilisation du Kelly Criterion pour déterminer la mise optimale
4. **Analyse de risque** - Classification faible/moyen/élevé basée sur la confiance

## 🎨 Stack technique

- **Framework**: Next.js 16 avec App Router
- **Langage**: TypeScript
- **Styling**: TailwindCSS
- **Icônes**: Lucide React
- **HTTP Client**: Axios

## 📊 Données

Actuellement, l'application utilise des données mockées car l'API des championnats de 1xbet nécessite une authentification. Les données incluent:

- 5 ligues FIFA Penalty
- 12 équipes avec statistiques complètes
- 6 matchs programmés
- Historique de forme pour chaque équipe

## 🔧 Améliorations futures

- Intégration réelle avec l'API 1xbet
- Système d'authentification
- Historique des prédictions
- Alertes en temps réel
- Dashboard analytics
- Mode dark/light toggle

## 📝 License

© 2026 FIFA Penalty Premium Prediction - SOLITAIRE HACK
