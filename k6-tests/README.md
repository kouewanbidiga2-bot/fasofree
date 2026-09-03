# FasoFree Load Test (k6)

## Installation

```bash
# Windows (scoop)
scoop install k6

# Windows (choco)
choco install k6

# macOS
brew install k6

# Linux
sudo snap install k6
```

## Lancer les tests

```bash
# Test complet (4 scénarios simultanés)
k6 run k6-tests/load-test.js

# Avec URL personnalisée
k6 run --env BASE_URL=https://api.fasofree.site/api/v1 k6-tests/load-test.js

# Mode smoke (validation rapide)
k6 run --vus 5 --duration 30s k6-tests/load-test.js

# Mode stress (test de limite)
k6 run --vus 200 --duration 5m k6-tests/load-test.js

# Exporter les résultats
k6 run --out json=k6-results.json k6-tests/load-test.js
```

## Scénarios

| Scénario | VUs max | Description |
|----------|---------|-------------|
| Browse restaurants | 200 | Clients parcourent les menus, catégories, promotions |
| Order simultaneously | 80 | Clients passent des commandes en même temps |
| Driver activity | 10 | Livreurs acceptent et livrent les commandes |
| Admin activity | 5 | Admins gèrent le dashboard, commandes, analytics |

## Métriques surveillées

- `http_req_duration` — Temps de réponse (p95 < 3s)
- `http_req_failed` — Taux d'échec (< 30%)
- `orders_created` — Nombre de commandes créées
- `login_success` / `login_failed` — Authentification
- `error_rate` — Taux d'erreur global

## Thresholds

- 95% des requêtes < 3s
- Moins de 30% d'erreurs
- Login < 2s
- Order < 5s
