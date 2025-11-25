const dbGet = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const dbRun = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Specific pet queries
const getUserEggs = (db, userId) => {
    return dbAll(db, 
        `SELECT name, COUNT(*) as count FROM petInventory 
         WHERE userId = ? AND type = 'egg' GROUP BY name`, 
        [userId]
    );
};

const getUserPets = (db, userId) => {
    return dbAll(db, 
        `SELECT * FROM petInventory WHERE userId = ? AND type = 'pet'`, 
        [userId]
    );
};

const getEquippedPets = (db, userId) => {
    return dbAll(db, 
        `SELECT p.* FROM equippedPets e
         JOIN petInventory p ON e.petId = p.petId
         WHERE e.userId = ?`, 
        [userId]
    );
};

const getHatchingEggs = (db, userId) => {
    return dbAll(db, 
        `SELECT * FROM hatchingEggs WHERE userId = ? ORDER BY hatchAt ASC`, 
        [userId]
    );
};

const getPetById = (db, petId) => {
    return dbGet(db, `SELECT * FROM petInventory WHERE petId = ?`, [petId]);
};

const deletePet = (db, petId) => {
    return dbRun(db, `DELETE FROM petInventory WHERE petId = ?`, [petId]);
};

const deleteHatchingEgg = (db, eggId) => {
    return dbRun(db, `DELETE FROM hatchingEggs WHERE id = ?`, [eggId]);
};

module.exports = {
    dbGet,
    dbAll,
    dbRun,
    getUserEggs,
    getUserPets,
    getEquippedPets,
    getHatchingEggs,
    getPetById,
    deletePet,
    deleteHatchingEgg
};