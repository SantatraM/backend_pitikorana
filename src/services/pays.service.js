import pool from "../config/db.js";
import Pays from "../models/Pays.js";

export async function getAllPays() {
    const result = await pool.query(
        `SELECT id, nom FROM pays ORDER BY nom ASC`,
    );

    return result.rows.map(
        (row) =>
        new Pays({
            id: row.id,
            nom: row.nom,
        }),
    );
}

export async function getPaysById(id) {
    const result = await pool.query(
        `SELECT id, nom FROM pays WHERE id = $1`,[id],
    );
    if (result.rows.length === 0) {
        return null;
    }
    return new Pays({
        id: result.rows[0].id,
        nom: result.rows[0].nom,
    });
}

export async function createPays(pays) {
    const result = await pool.query(
        `INSERT INTO pays (nom) VALUES ($1) RETURNING id, nom`,
        [pays.nom],
    );

    return new Pays({
        id: result.rows[0].id,
        nom: result.rows[0].nom,
    });
}

export async function updatePays(id, pays) {
    const result = await pool.query(
        `UPDATE pays SET nom = $1 WHERE id = $2 RETURNING id, nom`,
        [pays.nom, id],
    );

    if (result.rows.length === 0) {
        return null;
    }

    return new Pays({
        id: result.rows[0].id,
        nom: result.rows[0].nom,
    });
}

export async function deletePays(id) {
    const result = await pool.query(
        `DELETE FROM pays WHERE id = $1 RETURNING id, nom`,
        [id],
    );
    if (result.rows.length === 0) {
        return null;
    }
    return new Pays({
        id: result.rows[0].id,
        nom: result.rows[0].nom,
    });
}
