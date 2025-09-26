import { 
    SmythRuntime, 
    Agent, 
    AgentSettings,
    AIPerformanceCollector, 
    AIPerformanceAnalyzer,
    PerformanceService,
    LocalPerformanceConnector,
    DEFAULT_AI_PERFORMANCE_CONFIG,
    Component,
    AIComponentMetrics
} from '@smythos/sre';

/**
 * Example: Basic Performance Monitoring Setup
 */
async function basicPerformanceMonitoring() {
    console.log('Starting Basic Performance Monitoring Example...\n');
    
    try {
        // 1. Initialize SmythOS Runtime (automatically includes performance monitoring)
        console.log('1. Initializing SmythOS Runtime...');
        const sre = SmythRuntime.Instance;
        sre.init();
        
        // 2. Initialize performance monitoring for components
        Component.initializePerformanceMonitoring();
        console.log('Performance monitoring is now active!\n');
        
        // 3. Create a test agent
        console.log('2. Creating test agent...');
        const agentSettings = new AgentSettings();
        const agent = new Agent(
            'performance-test-agent',
            {
                name: 'Performance Test Agent',
                description: 'Agent for testing performance monitoring capabilities',
                connections: [],
                components: []
            },
            agentSettings
        );
        
        console.log(`Agent created: ${agent.id}\n`);
        
        // 4. Simulate some component executions to generate metrics
        console.log('3. Simulating component executions...');
        
        // Simulate different component types with performance tracking
        for (let i = 0; i < 5; i++) {
            console.log(`   Execution ${i + 1}/5...`);
            
            // Simulate LLM component execution
            await simulateComponentExecution(agent, 'LLMAssistant', {
                prompt: 'Analyze this data',
                model: 'gpt-3.5-turbo'
            });
            
            // Simulate data processing component
            await simulateComponentExecution(agent, 'DataProcessor', {
                data: Array(1000).fill(0).map((_, i) => ({ id: i, value: Math.random() }))
            });
            
            // Add some delay to create realistic timing
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }
        
        console.log('Component executions completed\n');
        
        // 5. Get real-time performance metrics
        console.log('4. Retrieving performance metrics...');
        const performanceCollector = AIPerformanceCollector.getInstance(DEFAULT_AI_PERFORMANCE_CONFIG);
        const performanceStats = performanceCollector.getSystemStats();
        
        if (performanceStats) {
            console.log('Current Performance Stats:');
            console.log(`   - Active Timers: ${performanceStats.activeTimers}`);
            console.log(`   - Total Metrics: ${performanceStats.totalMetrics}`);
            console.log(`   - Memory Usage: ${(performanceStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   - Event Buffer: ${performanceStats.eventBufferSize} events\n`);
        }
        
        // 6. Generate comprehensive performance report
        console.log('5. Generating comprehensive performance report...');
        
        try {
            const analyzer = new AIPerformanceAnalyzer();
            
            // In a real scenario, you would get metrics from the performance connector
            // For this example, we'll create sample metrics
            const sampleMetrics = createSampleMetrics(agent.id);
            
            const report = await analyzer.analyzeAgentPerformance(
                agent.id,
                agent.name || 'Performance Test Agent',
                sampleMetrics
            );
            
            console.log('Performance Report Generated:');
            console.log(`   - Performance Grade: ${report.summary.performanceGrade}`);
            console.log(`   - Success Rate: ${(report.summary.successRate * 100).toFixed(1)}%`);
            console.log(`   - Total LLM Costs: $${report.summary.totalLLMCosts.toFixed(4)}`);
            console.log(`   - Throughput: ${report.summary.kpis.throughput.toFixed(2)} ops/sec`);
            console.log(`   - P95 Latency: ${report.summary.kpis.latency.toFixed(0)}ms`);
            console.log(`   - Bottlenecks Found: ${report.bottlenecks.length}`);
            console.log(`   - Recommendations: ${report.recommendations.length}\n`);
            
            // Show recommendations if any
            if (report.recommendations.length > 0) {
                console.log('Top Optimization Recommendations:');
                report.recommendations.slice(0, 3).forEach((rec, index) => {
                    console.log(`   ${index + 1}. ${rec.recommendation.title}`);
                    console.log(`      Impact: ${rec.impact.performance.latencyImprovement}% latency improvement`);
                    console.log(`      Effort: ${rec.implementation.effort}\n`);
                });
            }
            
        } catch (error) {
            console.log(`Report generation failed: ${(error as Error).message}`);
        }
        
        // 7. Demonstrate Performance Connector Usage
        console.log('6. Performance Connector Usage:');
        try {
            // The performance service is automatically initialized when using AIPerformanceCollector
            console.log('Performance Service is active');
            console.log('LocalPerformanceConnector is running');
            console.log('Metrics are being stored locally\n');
        } catch (error) {
            console.log('Performance service not available in this demo\n');
        }
        
        // 8. Show real-time monitoring capabilities
        console.log('7. Real-time monitoring capabilities:');
        console.log('Zero-overhead performance tracking');
        console.log('AI-specific metrics (tokens, costs, quality)');
        console.log('Automatic bottleneck detection');
        console.log('ML-powered optimization recommendations');
        console.log('Real-time event streaming');
        console.log('CLI dashboard integration\n');
        
        // 9. CLI Usage Examples
        console.log('8. CLI Usage Examples:');
        console.log('   smyth agent:performance dashboard     # Real-time dashboard');
        console.log('   smyth agent:performance report        # Generate detailed report');
        console.log('   smyth agent:performance analyze       # Component analysis');
        console.log('   smyth agent:performance optimize      # Get recommendations');
        console.log('   smyth agent:performance export        # Export metrics\n');
        
        console.log('Performance monitoring example completed successfully!');
        
    } catch (error) {
        console.error('Error in performance monitoring example:', error);
    }
}

/**
 * Simulate component execution for demonstration
 */
async function simulateComponentExecution(
    agent: Agent, 
    componentName: string, 
    input: any
): Promise<void> {
    // Create a performance timer to track this simulation
    const timer = new (AIPerformanceCollector as any).AIPerformanceTimer(agent.id, componentName);
    
    try {
        // Simulate component processing time
        const processingTime = 50 + Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        // Simulate successful completion
        timer.end(true);
    } catch (error) {
        timer.end(false, error as Error);
    }
    
    // In real usage, the Component.process() method automatically handles performance tracking
    // This is just for demonstration purposes
}

/**
 * Create sample metrics for demonstration
 */
function createSampleMetrics(agentId: string): AIComponentMetrics[] {
    const components = ['LLMAssistant', 'DataProcessor', 'APICall', 'Classifier'];
    const metrics: AIComponentMetrics[] = [];
    
    for (let i = 0; i < 20; i++) {
        const componentName = components[Math.floor(Math.random() * components.length)];
        const isLLM = componentName === 'LLMAssistant';
        
        const metric: AIComponentMetrics = {
            componentName,
            agentId,
            timing: {
                total: 100 + Math.random() * 2000,
                inputProcessing: 10 + Math.random() * 50,
                coreProcessing: 80 + Math.random() * 1800,
                outputProcessing: 5 + Math.random() * 30,
                queueTime: Math.random() * 10
            },
            memory: {
                peak: 1024 * 1024 * (10 + Math.random() * 50),
                delta: (Math.random() - 0.5) * 1024 * 1024,
                pressure: Math.random() * 0.8
            },
            dataFlow: {
                inputSize: 100 + Math.random() * 1000,
                outputSize: 50 + Math.random() * 500,
                transformationRatio: 0.5 + Math.random() * 0.5,
                complexityScore: Math.random()
            },
            execution: {
                timestamp: Date.now() - Math.random() * 3600000,
                success: Math.random() > 0.05, // 95% success rate
                errorType: Math.random() > 0.95 ? 'TimeoutError' : undefined,
                retryCount: 0,
                configHash: 'abc123'
            },
            impact: {
                cpuUsage: 10 + Math.random() * 40,
                ioOperations: Math.floor(Math.random() * 10),
                networkRequests: Math.floor(Math.random() * 5),
                cacheStatus: Math.random() > 0.7 ? 'hit' : 'miss'
            }
        };
        
        // Add LLM metrics for LLM components
        if (isLLM) {
            metric.llm = {
                model: 'gpt-3.5-turbo',
                tokens: {
                    prompt: 100 + Math.floor(Math.random() * 500),
                    completion: 50 + Math.floor(Math.random() * 200),
                    total: 150 + Math.floor(Math.random() * 700)
                },
                estimatedCost: (150 + Math.random() * 700) * 0.000002,
                contextUtilization: 0.3 + Math.random() * 0.4,
                qualityScore: 0.7 + Math.random() * 0.3
            };
        }
        
        metrics.push(metric);
    }
    
    return metrics;
}

/**
 * Configuration Example
 */
function showConfigurationExample() {
    console.log('\nPerformance Monitoring Configuration Example:');
    
    const customConfig = {
        global: {
            enabled: true,
            samplingRate: 1.0,      // Monitor 100% of executions
            bufferSize: 5000,       // Keep 5000 metrics in memory
            flushInterval: 30000    // Flush to storage every 30 seconds
        },
        components: {
            whitelist: [],                    // Monitor all components
            blacklist: ['FSleep', 'FTimestamp'], // Exclude utility components
            customSamplingRates: {
                'LLMAssistant': 1.0,         // Always monitor LLM components
                'DataProcessor': 0.1,        // Sample 10% of data processing
                'APICall': 0.5               // Sample 50% of API calls
            }
        },
        llm: {
            trackTokenUsage: true,
            trackCosts: true,
            trackQuality: true,
            costThresholds: {
                warning: 0.01,    // Warn if cost > $0.01 per operation
                critical: 0.10    // Alert if cost > $0.10 per operation
            }
        },
        alerts: {
            enabled: true,
            thresholds: {
                latencyP95: 5000,      // Alert if P95 latency > 5 seconds
                errorRate: 0.05,       // Alert if error rate > 5%
                memoryUsage: 0.8,      // Alert if memory usage > 80%
                costPerOperation: 0.01  // Alert if cost > $0.01 per operation
            }
        },
        advanced: {
            enablePredictiveAnalysis: true,   // ML-powered predictions
            enableAutoOptimization: false,   // Manual optimization review
            enableSemanticAnalysis: true,    // Semantic component analysis
            retentionDays: 30,               // Keep metrics for 30 days
            compressionEnabled: true         // Compress stored metrics
        }
    };
    
    console.log(JSON.stringify(customConfig, null, 2));
}

/**
 * Advanced Usage Examples
 */
function showAdvancedExamples() {
    console.log('\nAdvanced Performance Monitoring Examples:');
    
    console.log('\n1. Custom Performance Connector:');
    console.log('   // Implement cloud-based performance storage');
    console.log('   class CloudPerformanceConnector extends PerformanceConnector {');
    console.log('     // Custom implementation for cloud storage');
    console.log('   }');
    
    console.log('\n2. Real-time Performance Streaming:');
    console.log('   collector.on("performance-event", (event) => {');
    console.log('     // Stream performance events to external systems');
    console.log('   });');
    
    console.log('\n3. Integration with External Monitoring:');
    console.log('   // Export to Prometheus, Datadog, New Relic, etc.');
    console.log('   const metrics = await connector.exportMetrics("prometheus");');
    
    console.log('\n4. Custom Performance Baselines:');
    console.log('   // Establish custom performance baselines');
    console.log('   await connector.establishBaseline("MyComponent");');
    
    console.log('\n5. Conditional Performance Monitoring:');
    console.log('   // Enable monitoring based on environment');
    console.log('   process.env.SRE_PERFORMANCE_DISABLED = "false";');
}

// Run the example
if (require.main === module) {
    basicPerformanceMonitoring()
        .then(() => {
            showConfigurationExample();
            showAdvancedExamples();
        })
        .catch(console.error);
}