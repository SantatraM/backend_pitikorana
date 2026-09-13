import pool from "../config/db.js";
import Ville from "../models/Ville.js";

function rowToVille(row) {
    return new Ville({
        id: row.id_ville,
        nom: row.nom_ville,
        id_region: row.id_region,

        region: {
        id: row.id_region,
        nom: row.nom_region,
        id_pays: row.id_pays,

        pays: {
            id: row.id_pays,
            nom: row.nom_pays,
        },
        },
    });
}

// =====================================================
// RECUPERER TOUTES LES VILLES
// =====================================================

export async function getAllVilles() {
    const result = await pool.query(
        `
        SELECT *
        FROM v_ville
        ORDER BY nom_ville ASC
        `,
    );

    return result.rows.map(rowToVille);
}

// =====================================================
// RECUPERER UNE VILLE PAR ID
// =====================================================

export async function getVilleById(id) {
    const result = await pool.query(
        `
        SELECT *
        FROM v_ville
        WHERE id_ville = $1
        `,
        [id],
    );

    if (result.rows.length === 0) {
        return null;
    }

    return rowToVille(result.rows[0]);
}

// =====================================================
// RECUPERER LES VILLES D'UNE REGION
// =====================================================

export async function getVillesByRegion(idRegion) {
    const result = await pool.query(
        `
        SELECT *
        FROM v_ville
        WHERE id_region = $1
        ORDER BY nom_ville ASC
        `,
        [idRegion],
    );

    return result.rows.map(rowToVille);
}

// =====================================================
// RECUPERER LES VILLES D'UN PAYS
// =====================================================

export async function getVillesByPays(idPays) {
    const result = await pool.query(
        `
        SELECT *
        FROM v_ville
        WHERE id_pays = $1
        ORDER BY nom_region ASC, nom_ville ASC
        `,
        [idPays],
    );

    return result.rows.map(rowToVille);
}

// =====================================================
// RECUPERER LES VILLES PAR PAYS ET REGION
// =====================================================

export async function getVillesByPaysAndRegion(idPays, idRegion) {
    const result = await pool.query(
        `
        SELECT *
        FROM v_ville
        WHERE id_pays = $1
        AND id_region = $2
        ORDER BY nom_ville ASC
        `,
        [idPays, idRegion],
    );

    return result.rows.map(rowToVille);
}

// =====================================================
// CREER UNE VILLE
// =====================================================

export async function createVille(ville) {
    const result = await pool.query(
        `
        INSERT INTO ville (
            nom,
            id_region
        )
        VALUES ($1, $2)
        RETURNING id
        `,
        [ville.nom, ville.id_region],
    );

    return getVilleById(result.rows[0].id);
}

// =====================================================
// MODIFIER UNE VILLE
// =====================================================

export async function updateVille(id, ville) {
    const result = await pool.query(
        `
        UPDATE ville
        SET
        nom = $1,
        id_region = $2
        WHERE id = $3
        RETURNING id
        `,
        [ville.nom, ville.id_region, id],
    );

    if (result.rows.length === 0) {
        return null;
    }

    return getVilleById(result.rows[0].id);
}

// =====================================================
// SUPPRIMER UNE VILLE
// =====================================================

export async function deleteVille(id) {
    const ville = await getVilleById(id);

    if (!ville) {
        return null;
    }

    await pool.query(
        `
        DELETE FROM ville
        WHERE id = $1
        `,
        [id],
    );

    return ville;
}
