import pool from "../config/db.js";
import Langue from "../models/Langue.js";

export async function getAllLangues() {
    const result = await pool.query(
        `SELECT id, code , nom FROM langue`, 
    );
    return result.rows.map(
        (row) => new Langue({
            id : row.id,
            code : row.code,
            nom : row.nom,
        })
    );
}