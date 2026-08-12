const { hammingDistance } = require('./src/utils/imageUtils');

// Test 1: Identical hashes
console.log('Test 1: Identical hashes');
const hash1 = 'a1b2c3d4e5f6a1b2';
const hash2 = 'a1b2c3d4e5f6a1b2';
const dist1 = hammingDistance(hash1, hash2);
console.log(`  Hash1: ${hash1}`);
console.log(`  Hash2: ${hash2}`);
console.log(`  Distance: ${dist1} (expected 0)`);
console.log(`  ✓ PASS\n` + (dist1 === 0 ? '✓ PASS\n' : '✗ FAIL\n'));

// Test 2: Slightly different hashes (one hex digit differs)
console.log('Test 2: One hex digit different');
const hash3 = 'a1b2c3d4e5f6a1b2';
const hash4 = 'a1b2c3d4e5f6a1b3'; // last digit differs
const dist2 = hammingDistance(hash3, hash4);
console.log(`  Hash3: ${hash3}`);
console.log(`  Hash4: ${hash4}`);
console.log(`  Distance: ${dist2} (expected 1)`);
console.log(dist2 === 1 ? '✓ PASS\n' : '✗ FAIL\n');

// Test 3: More different hashes
console.log('Test 3: Multiple bits different');
const hash5 = 'ffffffffffffffff';
const hash6 = '0000000000000000';
const dist3 = hammingDistance(hash5, hash6);
console.log(`  Hash5: ${hash5}`);
console.log(`  Hash6: ${hash6}`);
console.log(`  Distance: ${dist3} (expected 64)`);
console.log(dist3 === 64 ? '✓ PASS\n' : '✗ FAIL\n');

// Test 4: Within threshold (5 bits)
console.log('Test 4: Within threshold (distance 5)');
const hash7 = 'a1b2c3d4e5f6a1b2';
const hash8 = 'a1b2c3d4e5f6a1b7'; // differs by 1 bit in last digit
const dist4 = hammingDistance(hash7, hash8);
console.log(`  Hash7: ${hash7}`);
console.log(`  Hash8: ${hash8}`);
console.log(`  Distance: ${dist4}`);
console.log(`  Threshold: 5`);
console.log(dist4 <= 5 ? '✓ WOULD BE DUPLICATE\n' : '✗ NOT DUPLICATE\n');

// Test 5: Outside threshold
console.log('Test 5: Outside threshold (distance > 5)');
const hash9 = 'a1b2c3d4e5f6a1b2';
const hash10 = 'a1b2c3d4e5f6a1ff'; // differs by multiple bits
const dist5 = hammingDistance(hash9, hash10);
console.log(`  Hash9: ${hash9}`);
console.log(`  Hash10: ${hash10}`);
console.log(`  Distance: ${dist5}`);
console.log(`  Threshold: 5`);
console.log(dist5 > 5 ? '✓ NOT DUPLICATE\n' : '✗ WOULD BE DUPLICATE\n');

console.log('All tests complete!');
