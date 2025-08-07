const mikud = require('./app.js');

console.log('Testing mikud zipcode lookup...\n');

// Test data
const testAddresses = [
    {
        city: 'תל אביב',
        street: 'פרישמן',
        houseNumber: 7,
        entrance: 1
    },
    {
        city: 'ירושלים',
        street: 'הרצל',
        houseNumber: 10
    },
    {
        city: 'חיפה',
        street: 'הנביאים',
        houseNumber: 25
    }
];

// Test function
async function runTests() {
    console.log('🧪 Running performance tests...\n');
    
    for (let i = 0; i < testAddresses.length; i++) {
        const address = testAddresses[i];
        const startTime = process.hrtime.bigint();
        
        await new Promise((resolve) => {
            mikud(address, (err, zipcode) => {
                const endTime = process.hrtime.bigint();
                const duration = Number(endTime - startTime) / 1000000; // Convert to ms
                
                console.log(`Test ${i + 1}:`);
                console.log(`  Address: ${address.street} ${address.houseNumber}, ${address.city}`);
                
                if (err) {
                    console.log(`  ❌ Error: ${err}`);
                } else {
                    console.log(`  ✅ Zipcode: ${zipcode}`);
                }
                
                console.log(`  ⏱️  Duration: ${duration.toFixed(2)}ms\n`);
                resolve();
            });
        });
    }
    
    // Test cache performance by running the same request again
    console.log('🚀 Testing cache performance...\n');
    const address = testAddresses[0];
    const startTime = process.hrtime.bigint();
    
    await new Promise((resolve) => {
        mikud(address, (err, zipcode) => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000;
            
            console.log('Cache Test:');
            console.log(`  Address: ${address.street} ${address.houseNumber}, ${address.city}`);
            
            if (err) {
                console.log(`  ❌ Error: ${err}`);
            } else {
                console.log(`  ✅ Zipcode: ${zipcode} (from cache)`);
            }
            
            console.log(`  ⚡ Cached Duration: ${duration.toFixed(2)}ms (should be much faster!)\n`);
            resolve();
        });
    });
    
    console.log('🎉 Tests completed!');
}

// Error handling test
async function testErrorHandling() {
    console.log('🔧 Testing error handling...\n');
    
    await new Promise((resolve) => {
        mikud(null, (err, zipcode) => {
            console.log('Invalid input test:');
            if (err) {
                console.log(`  ✅ Correctly handled error: ${err}`);
            } else {
                console.log(`  ❌ Should have returned error but got: ${zipcode}`);
            }
            resolve();
        });
    });
    
    await new Promise((resolve) => {
        mikud({}, (err, zipcode) => {
            console.log('\nEmpty object test:');
            if (err) {
                console.log(`  ✅ Correctly handled error: ${err}`);
            } else {
                console.log(`  ❌ Should have returned error but got: ${zipcode}`);
            }
            resolve();
        });
    });
    
    console.log('\n🔧 Error handling tests completed!\n');
}

// Run all tests
async function main() {
    try {
        await testErrorHandling();
        await runTests();
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main();