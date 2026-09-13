import pool from "../config/db.js";
import Region from "../models/Region.js";

export async function getAllRegions() {
    const result = await pool.query(
        `
        SELECT
        r.id,
        r.nom,
        r.id_pays,
        p.nom AS nom_pays
        FROM region r
        JOIN pays p ON p.id = r.id_pays
        ORDER BY r.nom ASC
        `,
    );

    return result.rows.map(
        (row) =>
        new Region({
            id: row.id,
            nom: row.nom,
            id_pays: row.id_pays,

            pays: {
            id: row.id_pays,
            nom: row.nom_pays,
            },
        }),
    );
}

export async function getRegionById(id) {
    const result = await pool.query(
        `
        SELECT
        r.id,
        r.nom,
        r.id_pays,
        p.nom AS nom_pays
        FROM region r
        JOIN pays p ON p.id = r.id_pays
        WHERE r.id = $1
        `,
        [id],
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    return new Region({
        id: row.id,
        nom: row.nom,
        id_pays: row.id_pays,

        pays: {
            id: row.id_pays,
            nom: row.nom_pays,
        },
    });
}

export async function createRegion(region) {
    const result = await pool.query(
        `
        INSERT INTO region (nom, id_pays)
        VALUES ($1, $2)
        RETURNING id, nom, id_pays
        `,
        [region.nom, region.id_pays],
    );

    return getRegionById(result.rows[0].id);
}

export async function updateRegion(id, region) {
    const result = await pool.query(
        `
        UPDATE region
        SET
        nom = $1,
        id_pays = $2
        WHERE id = $3
        RETURNING id
        `,
        [region.nom, region.id_pays, id],
    );

    if (result.rows.length === 0) {
        return null;
    }

    return getRegionById(result.rows[0].id);
}

export async function deleteRegion(id) {
    const region = await getRegionById(id);

    if (!region) {
        return null;
    }

    await pool.query(
        `
        DELETE FROM region
        WHERE id = $1
        `,
        [id],
    );

    return region;
}
