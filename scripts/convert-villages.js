const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Converts villages Excel file to JSON format for bundling with app
 *
 * Usage: node scripts/convert-villages.js [path-to-excel-file]
 */

function convertVillagesToJson(excelPath) {
  console.log('📖 Reading Excel file:', excelPath);

  // Read Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  console.log('📊 Sheet name:', sheetName);

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`📝 Found ${data.length} rows`);

  // Transform to optimized format
  const villages = data.map((row, index) => ({
    village_id: row.village_id || `V${String(index + 1).padStart(6, '0')}`,
    village_name: String(row.village_name || '').trim(),
    parish_name: String(row.parish_name || '').trim(),
    subcounty_name: String(row.subcounty_name || '').trim(),
    District: String(row.District || '').trim()
  }));

  // Validate data
  const invalidRecords = villages.filter(v =>
    !v.village_name || !v.District
  );

  if (invalidRecords.length > 0) {
    console.warn(`⚠️  Warning: ${invalidRecords.length} records missing required fields`);
  }

  // Statistics
  const uniqueDistricts = new Set(villages.map(v => v.District));
  const uniqueSubcounties = new Set(villages.map(v => `${v.District}|${v.subcounty_name}`));
  const uniqueParishes = new Set(villages.map(v => `${v.District}|${v.subcounty_name}|${v.parish_name}`));

  console.log('\n📈 Statistics:');
  console.log(`   Total villages: ${villages.length}`);
  console.log(`   Unique districts: ${uniqueDistricts.size}`);
  console.log(`   Unique subcounties: ${uniqueSubcounties.size}`);
  console.log(`   Unique parishes: ${uniqueParishes.size}`);
  console.log(`   Avg villages per district: ${Math.round(villages.length / uniqueDistricts.size)}`);

  // Calculate file size
  const jsonString = JSON.stringify(villages);
  const fileSizeMB = jsonString.length / 1024 / 1024;
  console.log(`   File size: ${fileSizeMB.toFixed(2)} MB`);

  // Ensure public/data directory exists
  const outputDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created directory: ${outputDir}`);
  }

  // Write to public/data/villages.json
  const outputPath = path.join(outputDir, 'villages.json');
  fs.writeFileSync(outputPath, jsonString);

  console.log(`\n✅ Villages exported to: ${outputPath}`);
  console.log(`   Ready to be bundled with app!`);

  return villages;
}

// Main execution
if (require.main === module) {
  const excelPath = process.argv[2];

  if (!excelPath) {
    console.error('❌ Error: Please provide path to Excel file');
    console.log('\nUsage: node scripts/convert-villages.js <path-to-excel-file>');
    console.log('Example: node scripts/convert-villages.js villages.xlsx');
    process.exit(1);
  }

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Error: File not found: ${excelPath}`);
    process.exit(1);
  }

  try {
    convertVillagesToJson(excelPath);
  } catch (error) {
    console.error('❌ Error converting file:', error.message);
    process.exit(1);
  }
}

module.exports = { convertVillagesToJson };
