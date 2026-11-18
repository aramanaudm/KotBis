SELECT c.id::text                 AS id,
       v.pseudo                   AS pseudo,
       lower(c.email)             AS email,
       r.code                     AS role,
       c.etat                     AS status,
       COALESCE(v.zone_libre, '—') AS city,
       v.avatar_ref               AS avatar_ref,
       c.cree_le                  AS created_at,
       COALESCE(s.solde, 0)       AS points
FROM voyageurs v
JOIN comptes c ON c.id = v.compte_id
JOIN roles r ON r.id = c.role_id
LEFT JOIN v_soldes_voyageurs s ON s.voyageur_id = v.compte_id
ORDER BY c.cree_le DESC;
