import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

async function exportToD1Sql() {
  console.log('--- Generating Cloudflare D1 SQL Migration Dump ---');
  const SQL = await initSqlJs();
  const dataDir = path.join(process.cwd(), 'data');
  const outFile = path.join(process.cwd(), 'd1_seed.sql');
  
  let sqlDump = `-- Auto-generated Cloudflare D1 Data Migration Dump\n-- Generated on: ${new Date().toISOString()}\n\n`;

  const dbFiles = fs.existsSync(dataDir) 
    ? fs.readdirSync(dataDir).filter(f => f.startsWith('FY') && f.endsWith('.db'))
    : [];

  if (fs.existsSync(path.join(process.cwd(), 'tracker.db')) && dbFiles.length === 0) {
    dbFiles.push('../tracker.db');
  }

  const tables = [
    'users',
    'bank_accounts',
    'items',
    'entries',
    'payments',
    'advances',
    'vendor_advances',
    'client_adjustments',
    'vendor_adjustments',
    'bank_transactions',
    'stock_movements',
    'production_runs',
    'production_materials',
    'challan_sequence'
  ];

  for (const file of dbFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;

    const fyMatch = file.match(/FY([0-9]{4}-[0-9]{2})/);
    const fy = fyMatch ? fyMatch[1] : '2025-26';
    console.log(`Processing database for FY: ${fy} (${file})`);

    const fileBuf = fs.readFileSync(filePath);
    const db = new SQL.Database(fileBuf);

    sqlDump += `\n-- ==================== DATA FOR FINANCIAL YEAR: ${fy} ====================\n`;
    sqlDump += `INSERT OR IGNORE INTO financial_years (label, start_date, end_date, is_default) VALUES ('${fy}', '${fy.split('-')[0]}-04-01', '${parseInt(fy.split('-')[0]) + 1}-03-31', 0);\n`;

    for (const table of tables) {
      try {
        const check = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
        if (!check || check.length === 0 || !check[0].values.length) continue;

        const res = db.exec(`SELECT * FROM ${table}`);
        if (!res || res.length === 0) continue;

        const cols = res[0].columns;
        const rows = res[0].values;

        if (rows.length === 0) continue;

        const hasFyCol = cols.includes('fy');
        const insertCols = hasFyCol ? cols : ['fy', ...cols];

        for (const row of rows) {
          const formattedVals = row.map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          const finalVals = hasFyCol ? formattedVals : [`'${fy}'`, ...formattedVals];
          sqlDump += `INSERT OR IGNORE INTO ${table} (${insertCols.join(', ')}) VALUES (${finalVals.join(', ')});\n`;
        }
      } catch (err: any) {
        console.warn(`Skipping table ${table} for ${fy}:`, err.message);
      }
    }
  }

  fs.writeFileSync(outFile, sqlDump, 'utf-8');
  console.log(`\nSuccessfully wrote Cloudflare D1 SQL dump to: ${outFile}`);
  console.log(`To import into Cloudflare D1, run:`);
  console.log(`wrangler d1 execute <YOUR_DB_NAME> --file=./d1_seed.sql\n`);
}

exportToD1Sql().catch(console.error);
