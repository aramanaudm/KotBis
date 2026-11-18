SELECT c.id::text            AS id,
       p.nom_affiche         AS name,
       lower(c.email)        AS email,
       r.code                AS role,
       c.etat                AS status,
       COALESCE(p.fonction, '—') AS "function",
       c.cree_le             AS created_at
FROM comptes c
JOIN roles r ON r.id = c.role_id
JOIN personnel p ON p.compte_id = c.id
WHERE r.code IN ('operateur', 'moderateur', 'administrateur')
ORDER BY c.cree_le DESC;
