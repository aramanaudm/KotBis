# [BUS-FE-053] Préparer l'interface d'administration des signalements

Références : Cahier des charges Frontend BF-14, DoD-A01, AC-38, point ouvert Q-03 ;
Cahier des charges BO, BF-ADM-09.

## Décision de périmètre

Le ticket impose de ne développer l'interface que si elle relève du périmètre Frontend
et après validation. Q-03 n'est pas tranché dans le cahier Frontend, et l'interface existe
déjà dans le back-office web (`backoffice/`, route `/signalements`, `ReportsPage`).

Aucun écran d'administration n'est donc ajouté à l'application mobile.

## Ce qui est livré

- `core/auth/admin-access.guard.ts` : garde `canMatch` sur toute adresse `/admin/...`.
  Aucun écran n'est chargé ; un message de refus s'affiche et l'utilisateur revient à `/home`.
- `app.routes.ts` : route `admin` protégée par ce garde.
- `core/auth/admin-access.guard.spec.ts` : `/admin`, `/admin/reports` et
  `/admin/reports/42/status` redirigent vers l'accueil avec le message.

Le refus définitif reste côté API (403 sur `/admin/reports`, AC-38) ; le garde n'en est que
le reflet côté client. Aucun rôle n'est lu ni envoyé par l'application (AC-21).

## Écarts relevés dans le back-office (à transmettre à l'équipe BO)

| Cahier Frontend (BF-14, DoD-A01) | Back-office actuel |
|---|---|
| Statuts : À vérifier, Confirmé, Rejeté, Clôturé | À vérifier, Confirmé, Classé sans suite |
| Transitions limitées à RG06 | Toute transition proposée dans la liste |
| Justification obligatoire | Aucun champ de justification |
| `PATCH /admin/reports/{id}/status` | `PUT /api/admin/reports/{id}` |