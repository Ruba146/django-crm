const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Testing /api/graph/lead-categories ===');
  const cats = await fetch('http://localhost:3000/api/graph/lead-categories');
  console.log('Status:', cats.status);
  console.log('Total categories:', cats.data.length);
  console.log('Categories:', cats.data.map(c => `${c.label}: ${c.count}`).join('\n  '));
  console.log('Total leads:', cats.data.reduce((s, c) => s + c.count, 0));

  console.log('\n=== Testing /api/graph/category-leads?categoryId=technology&pageSize=5 ===');
  const leads = await fetch('http://localhost:3000/api/graph/category-leads?categoryId=technology&pageSize=5');
  console.log('Status:', leads.status);
  console.log('Total:', leads.data.total);
  console.log('Records:', leads.data.records.length);
  console.log('Sample:', leads.data.records.slice(0, 3).map(r => r.displayName).join(', '));

  console.log('\n=== Testing /api/graph/search?q=test ===');
  const search = await fetch('http://localhost:3000/api/graph/search?q=test');
  console.log('Status:', search.status);
  console.log('Results:', search.data.results.length);
  const leadResults = search.data.results.filter(r => r.type === 'lead');
  console.log('Lead results:', leadResults.length);
  console.log('Sample lead:', leadResults[0]?.label, leadResults[0]?.categoryId);
}

main().catch(console.error);
