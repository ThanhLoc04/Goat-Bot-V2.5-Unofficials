const fs = require('fs');
const path = require('path');

class Collection {
    constructor(name) {
        this.name = name;
        this.path = path.join(__dirname, '..', 'data', `${name}.json`);
        this._initFile();
    }

    _initFile() {
        const dir = path.dirname(this.path);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.path)) {
            fs.writeFileSync(this.path, '[]');
        }
    }

    _read() {
        try {
            return JSON.parse(fs.readFileSync(this.path, 'utf-8'));
        } catch {
            return [];
        }
    }

    _write(data) {
        fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
    }

    find(query = {}) {
        const data = this._read();
        return data.filter(doc =>
            Object.entries(query).every(([key, value]) =>
                JSON.stringify(doc[key]) === JSON.stringify(value)
            )
        );
    }

    findOne(query = {}) {
        return this.find(query)[0] || null;
    }

    addOne(doc) {
        const data = this._read();
        const existingIndex = data.findIndex(item => item._id === doc._id);

        if (existingIndex !== -1) {
            // Cập nhật document nếu đã tồn tại
            data[existingIndex] = {
                ...data[existingIndex],
                ...doc,
                timestamp: doc.timestamp || new Date().toISOString()
            };
        } else {
            // Thêm document mới nếu chưa có
            doc.timestamp = doc.timestamp || new Date().toISOString();
            data.push(doc);
        }

        this._write(data);
        return data[existingIndex !== -1 ? existingIndex : data.length - 1];
    }

    updateOneUsingId(id, update) {
        const data = this._read();
        const index = data.findIndex(doc => doc._id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...update };
            this._write(data);
            return data[index];
        }
        return null;
    }

    deleteOneUsingId(id) {
        const data = this._read().filter(doc => doc._id !== id);
        this._write(data);
        return true;
    }

    deleteMany(query = {}) {
        const data = this._read().filter(doc =>
            !Object.entries(query).every(([key, value]) => doc[key] === value)
        );
        this._write(data);
        return true;
    }
}

class Database {
    createCollection(name) {
        return new Collection(name);
    }
}

module.exports = {
    database: new Database()
};
