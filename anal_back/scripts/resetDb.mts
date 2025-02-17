import { resetDatabase } from '../database.js';

console.log('Starting database reset...');

async function main() {
  try {
    await resetDatabase();
    console.log('✅ Database reset successful');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

main();
