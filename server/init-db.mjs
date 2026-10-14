import 'dotenv/config';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
const name = process.env.DB_NAME || 'dreamscape_yangzheng';
if (!/^[a-zA-Z0-9_]+$/.test(name)) throw Error('数据库名只允许字母、数字和下划线');
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});
try {
  const sql = (
    await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8')
  ).replaceAll('dreamscape_yangzheng', name);
  await conn.query(sql);
  console.log('已创建专用数据库及5张关联表：' + name);
} finally {
  await conn.end();
}
