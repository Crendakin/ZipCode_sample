const mikud = require('./app.js');

console.log('🚀 Mikud Performance Benchmark\n');
console.log('===============================\n');

// Benchmark configuration
const BENCHMARK_ITERATIONS = 10;
const TEST_ADDRESS = {
    city: 'תל אביב',
    street: 'פרישמן',
    houseNumber: 7,
    entrance: 1
};

// Performance metrics
const metrics = {
    requests: [],
    cached: [],
    errors: 0,
    totalRequests: 0
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getMemoryUsage() {
    const used = process.memoryUsage();
    return {
        rss: used.rss,
        heapTotal: used.heapTotal,
        heapUsed: used.heapUsed,
        external: used.external
    };
}

async function benchmarkRequest(iteration, useCache = false) {
    return new Promise((resolve) => {
        const startMemory = getMemoryUsage();
        const startTime = process.hrtime.bigint();
        
        mikud(TEST_ADDRESS, (err, zipcode) => {
            const endTime = process.hrtime.bigint();
            const endMemory = getMemoryUsage();
            const duration = Number(endTime - startTime) / 1000000; // Convert to ms
            
            metrics.totalRequests++;
            
            if (err) {
                metrics.errors++;
                console.log(`  ❌ Request ${iteration}: Error - ${err}`);
            } else {
                const result = {
                    iteration,
                    duration,
                    zipcode,
                    memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
                    fromCache: useCache
                };
                
                if (useCache) {
                    metrics.cached.push(result);
                } else {
                    metrics.requests.push(result);
                }
                
                console.log(`  ✅ Request ${iteration}: ${duration.toFixed(2)}ms ${useCache ? '(cached)' : ''}`);
            }
            
            resolve();
        });
    });
}

async function runBenchmark() {
    console.log(`📊 Running ${BENCHMARK_ITERATIONS} requests to measure performance...\n`);
    
    const initialMemory = getMemoryUsage();
    console.log('Initial Memory Usage:');
    console.log(`  RSS: ${formatBytes(initialMemory.rss)}`);
    console.log(`  Heap Used: ${formatBytes(initialMemory.heapUsed)}`);
    console.log(`  Heap Total: ${formatBytes(initialMemory.heapTotal)}\n`);
    
    // Measure uncached requests
    console.log('🌐 Testing network requests (no cache):');
    for (let i = 1; i <= BENCHMARK_ITERATIONS; i++) {
        await benchmarkRequest(i, false);
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n⚡ Testing cached requests:');
    // Measure cached requests
    for (let i = 1; i <= 5; i++) {
        await benchmarkRequest(i, true);
    }
    
    // Memory usage after tests
    const finalMemory = getMemoryUsage();
    console.log('\n📈 Final Memory Usage:');
    console.log(`  RSS: ${formatBytes(finalMemory.rss)}`);
    console.log(`  Heap Used: ${formatBytes(finalMemory.heapUsed)}`);
    console.log(`  Heap Total: ${formatBytes(finalMemory.heapTotal)}`);
    
    // Calculate statistics
    const networkRequests = metrics.requests.filter(r => !r.fromCache);
    const cachedRequests = metrics.cached;
    
    if (networkRequests.length > 0) {
        const networkTimes = networkRequests.map(r => r.duration);
        const avgNetworkTime = networkTimes.reduce((a, b) => a + b, 0) / networkTimes.length;
        const minNetworkTime = Math.min(...networkTimes);
        const maxNetworkTime = Math.max(...networkTimes);
        
        console.log('\n📊 Network Request Statistics:');
        console.log(`  Average: ${avgNetworkTime.toFixed(2)}ms`);
        console.log(`  Min: ${minNetworkTime.toFixed(2)}ms`);
        console.log(`  Max: ${maxNetworkTime.toFixed(2)}ms`);
        console.log(`  Total Requests: ${networkRequests.length}`);
    }
    
    if (cachedRequests.length > 0) {
        const cachedTimes = cachedRequests.map(r => r.duration);
        const avgCachedTime = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;
        const minCachedTime = Math.min(...cachedTimes);
        const maxCachedTime = Math.max(...cachedTimes);
        
        console.log('\n⚡ Cached Request Statistics:');
        console.log(`  Average: ${avgCachedTime.toFixed(2)}ms`);
        console.log(`  Min: ${minCachedTime.toFixed(2)}ms`);
        console.log(`  Max: ${maxCachedTime.toFixed(2)}ms`);
        console.log(`  Total Cached: ${cachedRequests.length}`);
        
        if (networkRequests.length > 0) {
            const avgNetworkTime = networkRequests.map(r => r.duration).reduce((a, b) => a + b, 0) / networkRequests.length;
            const speedup = avgNetworkTime / avgCachedTime;
            console.log(`  🚀 Cache Speedup: ${speedup.toFixed(1)}x faster!`);
        }
    }
    
    console.log('\n🎯 Overall Performance Summary:');
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Successful: ${metrics.totalRequests - metrics.errors}`);
    console.log(`  Errors: ${metrics.errors}`);
    console.log(`  Success Rate: ${((metrics.totalRequests - metrics.errors) / metrics.totalRequests * 100).toFixed(1)}%`);
    
    // Memory efficiency
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
    console.log(`  Memory Delta: ${formatBytes(memoryDelta)}`);
    console.log(`  Memory per Request: ${formatBytes(memoryDelta / metrics.totalRequests)}`);
}

async function main() {
    try {
        await runBenchmark();
        console.log('\n✨ Benchmark completed successfully!');
    } catch (error) {
        console.error('\n❌ Benchmark failed:', error);
        process.exit(1);
    }
}

main();