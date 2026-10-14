import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

// 表名和字段使用白名单；用户输入的值通过参数化查询传入。
const fields = {
  users: ['id', 'username', 'password_hash', 'display_name', 'created_at'],
  dreams: [
    'id',
    'user_id',
    'title',
    'original_text',
    'life_context',
    'dream_date',
    'self_emotion',
    'self_intensity',
    'completion_mode',
    'completed_text',
    'completion_confirmed',
    'favorite',
    'created_at',
    'updated_at',
  ],
  analyses: ['id', 'dream_id', 'result_json', 'model_name', 'input_source', 'created_at'],
  analysis_references: [
    'id',
    'analysis_id',
    'source_id',
    'title',
    'authors',
    'publication_year',
    'doi',
    'url',
    'abstract_text',
  ],
  generated_images: [
    'id',
    'dream_id',
    'analysis_id',
    'style',
    'prompt',
    'source_version',
    'task_id',
    'status',
    'local_url',
    'error_message',
    'model_name',
    'created_at',
  ],
};

function check(table, keys = []) {
  if (!fields[table] || keys.some((k) => !fields[table].includes(k)))
    throw Error('不允许的数据字段');
}

// 对外提供相同的数据访问方法，内部区分 MySQL 与示例文件。
export class Store {
  constructor(demo, seed) {
    this.demo = demo;
    this.seed = seed;
    this.queue = Promise.resolve();
  }
  async init() {
    if (this.demo) {
      this.file = path.resolve(process.env.DEMO_DATA_FILE || 'data/demo.json');
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      try {
        this.data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        this.data = this.seed;
        await this.save();
      }
    } else {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dreamscape_yangzheng',
        charset: 'utf8mb4',
        connectionLimit: 5,
        dateStrings: true,
      });
      await this.pool.query('SELECT 1');
      const [columns] = await this.pool.query("SHOW COLUMNS FROM dreams LIKE 'life_context'");
      if (!columns.length) {
        try {
          await this.pool.query(
            'ALTER TABLE dreams ADD COLUMN life_context TEXT NULL AFTER original_text',
          );
        } catch (e) {
          if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        }
      }
    }
  }
  async save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.queue = this.queue.then(async () => {
      await fs.writeFile(this.file + '.tmp', snapshot);
      await fs.rename(this.file + '.tmp', this.file);
    });
    await this.queue;
  }
  async list(table, where = {}) {
    check(table, Object.keys(where));
    if (this.demo)
      return structuredClone(
        this.data[table].filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)),
      );
    const keys = Object.keys(where);
    const [rows] = await this.pool.execute(
      `SELECT * FROM \`${table}\`${keys.length ? ' WHERE ' + keys.map((k) => `\`${k}\` = ?`).join(' AND ') : ''}`,
      Object.values(where),
    );
    return rows;
  }
  async one(table, where) {
    return (await this.list(table, where))[0] || null;
  }
  async insert(table, row) {
    check(table, Object.keys(row));
    if (this.demo) {
      this.data[table].push(structuredClone(row));
      await this.save();
      return row;
    }
    const keys = Object.keys(row);
    await this.pool.execute(
      `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map((k) =>
        row[k] !== null && typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k],
      ),
    );
    return row;
  }
  async update(table, id, patch) {
    check(table, Object.keys(patch));
    if (this.demo) {
      const row = this.data[table].find((r) => r.id === id);
      if (row) Object.assign(row, patch);
      await this.save();
      return;
    }
    const keys = Object.keys(patch);
    await this.pool.execute(
      `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(',')} WHERE id=?`,
      [
        ...keys.map((k) =>
          patch[k] !== null && typeof patch[k] === 'object' ? JSON.stringify(patch[k]) : patch[k],
        ),
        id,
      ],
    );
  }
  async removeDream(id) {
    if (this.demo) {
      const ids = this.data.analyses.filter((a) => a.dream_id === id).map((a) => a.id);
      this.data.analysis_references = this.data.analysis_references.filter(
        (r) => !ids.includes(r.analysis_id),
      );
      this.data.analyses = this.data.analyses.filter((a) => a.dream_id !== id);
      this.data.generated_images = this.data.generated_images.filter((a) => a.dream_id !== id);
      this.data.dreams = this.data.dreams.filter((a) => a.id !== id);
      await this.save();
    } else await this.pool.execute('DELETE FROM dreams WHERE id=?', [id]);
  }
}
