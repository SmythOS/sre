# 🚀 SmythOS AI Performance Monitoring System

The **AI Performance Monitoring System** is an enterprise-grade, zero-overhead performance monitoring solution specifically designed for AI agents and LLM workloads. It provides real-time insights, intelligent bottleneck detection, and ML-powered optimization recommendations.

## ✨ Key Features

### 🎯 **AI-Native Monitoring**
- **LLM-Specific Metrics**: Token usage, costs, context utilization, quality scores
- **Semantic Analysis**: Component affinity, information flow analysis
- **Model Performance**: Track performance across different LLM models
- **Cost Optimization**: Real-time cost tracking and optimization suggestions

### ⚡ **Zero-Overhead Design**
- **Sub-millisecond Impact**: <0.1ms overhead per component execution
- **Intelligent Sampling**: Adaptive sampling based on component importance
- **Memory Efficient**: Circular buffers with automatic size management
- **Feature Flags**: Easy enable/disable without code changes

### 🧠 **Intelligent Analysis**
- **ML-Powered Insights**: Statistical analysis and anomaly detection
- **Bottleneck Detection**: Real-time identification of performance issues
- **Predictive Analytics**: Trend analysis and performance predictions
- **Auto-Optimization**: Automated recommendations with impact analysis

### 📊 **Enterprise Integration**
- **CLI Dashboard**: Beautiful real-time performance dashboard
- **Export Formats**: JSON, CSV, Prometheus metrics
- **External Integration**: Datadog, New Relic, CloudWatch ready
- **Secure Access**: Full ACL integration with SRE security model

## 🚀 Quick Start

### 1. Basic Usage (Zero Configuration)

Performance monitoring is **automatically enabled** when you use SmythOS SRE:

```typescript
import { SmythRuntime, Agent } from '@smythos/sre';

// Initialize SRE (performance monitoring starts automatically)
await SmythRuntime.init();

// Create agent (all components automatically monitored)
const agent = await Agent.create({
    name: 'My Agent'
});

// All component executions are now being tracked!
// No additional code required
```

### 2. CLI Dashboard

```bash
# Real-time performance dashboard
smyth agent:performance dashboard

# Generate detailed report
smyth agent:performance report --agent agent-123

# Component analysis
smyth agent:performance analyze --component LLMAssistant

# Get optimization recommendations
smyth agent:performance optimize --auto

# Export metrics
smyth agent:performance export --format prometheus
```

### 3. Programmatic Access

```typescript
import { 
    AIPerformanceCollector, 
    AIPerformanceAnalyzer,
    Component 
} from '@smythos/sre';

// Get real-time metrics
const stats = await Component.getComponentMetrics();
console.log(`Active timers: ${stats.activeTimers}`);

// Generate detailed report
const analyzer = new AIPerformanceAnalyzer();
const report = await analyzer.analyzeAgentPerformance(
    agentId, 
    agentName, 
    metrics
);

console.log(`Performance Grade: ${report.summary.performanceGrade}`);
console.log(`LLM Costs: $${report.summary.totalLLMCosts}`);
```

## 📋 Configuration

### Environment Variables

```bash
# Disable performance monitoring
export SRE_PERFORMANCE_DISABLED=true

# Custom configuration directory
export SRE_PERFORMANCE_DIR=/path/to/performance/data
```

### Advanced Configuration

```typescript
import { AIPerformanceCollector } from '@smythos/sre';

const customConfig = {
    global: {
        enabled: true,
        samplingRate: 1.0,      // 100% sampling
        bufferSize: 5000,       // Keep 5K metrics
        flushInterval: 30000    // Flush every 30s
    },
    components: {
        whitelist: [],                    // Monitor all
        blacklist: ['FSleep'],           // Skip utilities
        customSamplingRates: {
            'LLMAssistant': 1.0,         // Always monitor LLM
            'DataProcessor': 0.1         // 10% sampling
        }
    },
    llm: {
        trackTokenUsage: true,
        trackCosts: true,
        trackQuality: true,
        costThresholds: {
            warning: 0.01,    // $0.01 warning
            critical: 0.10    // $0.10 alert
        }
    },
    alerts: {
        enabled: true,
        thresholds: {
            latencyP95: 5000,      // 5s latency
            errorRate: 0.05,       // 5% error rate
            memoryUsage: 0.8,      // 80% memory
            costPerOperation: 0.01  // $0.01/operation
        }
    },
    advanced: {
        enablePredictiveAnalysis: true,
        enableAutoOptimization: false,
        enableSemanticAnalysis: true,
        retentionDays: 30,
        compressionEnabled: true
    }
};

const collector = AIPerformanceCollector.getInstance(customConfig);
```

## 📊 Metrics & Reports

### Component Metrics

Each component execution automatically tracks:

```typescript
interface AIComponentMetrics {
    componentName: string;
    agentId: string;
    
    // Timing breakdown
    timing: {
        total: number;              // Total execution time
        inputProcessing: number;    // Input processing time
        coreProcessing: number;     // Core logic time
        outputProcessing: number;   // Output processing time
        queueTime: number;          // Time spent waiting
    };
    
    // Memory usage
    memory: {
        peak: number;               // Peak memory usage
        delta: number;              // Memory change
        pressure: number;           // Memory pressure (0-1)
    };
    
    // Data flow
    dataFlow: {
        inputSize: number;          // Input data size
        outputSize: number;         // Output data size
        transformationRatio: number; // Output/input ratio
        complexityScore: number;    // Data complexity (0-1)
    };
    
    // LLM metrics (if applicable)
    llm?: {
        model: string;
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
        estimatedCost: number;      // USD cost estimate
        contextUtilization: number; // Context window usage
        qualityScore?: number;      // Response quality
    };
    
    // Execution metadata
    execution: {
        timestamp: number;
        success: boolean;
        errorType?: string;
        retryCount: number;
        configHash: string;
    };
}
```

### Performance Reports

Comprehensive reports include:

- **Executive Summary**: Performance grade, KPIs, success rates
- **Component Analysis**: Individual component performance metrics
- **AI Insights**: LLM optimization opportunities, semantic analysis
- **Bottlenecks**: Identified performance issues with solutions
- **Recommendations**: ML-powered optimization suggestions
- **Trends**: Performance trends and predictions

## 🔧 Advanced Features

### 1. Custom Performance Connectors

```typescript
import { PerformanceConnector } from '@smythos/sre';

class CloudPerformanceConnector extends PerformanceConnector {
    protected async storeMetrics(accessRequest, metrics) {
        // Store metrics in cloud database
        await this.cloudDB.insert(metrics);
    }
    
    protected async getMetrics(accessRequest, timeWindow) {
        // Retrieve metrics from cloud
        return await this.cloudDB.query(timeWindow);
    }
}
```

### 2. Real-time Event Streaming

```typescript
import { AIPerformanceCollector } from '@smythos/sre';

const collector = AIPerformanceCollector.getInstance();

// Listen for performance events
collector.on('performance-event', (event) => {
    console.log(`Event: ${event.type}`);
    
    if (event.type === 'bottleneck_detected') {
        console.log(`Bottleneck in ${event.source.componentName}`);
        // Send alert to monitoring system
    }
});

// Listen for batch flushes
collector.on('batch-flush', (events) => {
    console.log(`Batch flush: ${events.length} events`);
    // Stream to external systems
});
```

### 3. External System Integration

```typescript
// Export to Prometheus
const prometheusMetrics = await connector.exportMetrics('prometheus');

// Export to CSV for analysis
const csvData = await connector.exportMetrics('csv');

// Custom export format
const jsonData = await connector.exportMetrics('json');
```

### 4. Performance Baselines

```typescript
// Establish baseline for component
const baseline = await connector.establishBaseline('LLMAssistant');

console.log(`Baseline established with ${baseline.sampleSize} samples`);
console.log(`P95 latency baseline: ${baseline.baseline.latency.p95}ms`);
```

## 🎯 Use Cases

### 1. **Development & Testing**
- Monitor component performance during development
- Identify bottlenecks in agent workflows
- Validate performance improvements

### 2. **Production Monitoring**
- Real-time performance monitoring
- Cost tracking and optimization
- SLA compliance monitoring

### 3. **Cost Optimization**
- Track LLM costs across agents
- Identify expensive operations
- Optimize model selection

### 4. **Capacity Planning**
- Analyze performance trends
- Predict resource requirements
- Plan for scaling

### 5. **Troubleshooting**
- Identify performance regressions
- Debug slow components
- Analyze error patterns

## 📈 Performance Impact

The monitoring system is designed for **zero-overhead production use**:

- **Execution Overhead**: <0.1ms per component
- **Memory Overhead**: <5MB for 10K metrics
- **CPU Impact**: <1% additional CPU usage
- **Storage**: Efficient compression and retention policies

## 🛡️ Security & Privacy

- **Access Control**: Full ACL integration
- **Data Isolation**: Agent-specific metric isolation
- **Secure Export**: Encrypted data export options
- **Privacy**: No sensitive data stored in metrics

## 🚦 Best Practices

### 1. **Sampling Strategy**
```typescript
// High-value components: 100% sampling
customSamplingRates: {
    'LLMAssistant': 1.0,
    'CriticalComponent': 1.0
}

// High-volume components: Reduced sampling
customSamplingRates: {
    'DataProcessor': 0.1,  // 10% sampling
    'Utility': 0.01        // 1% sampling
}
```

### 2. **Cost Monitoring**
```typescript
// Set cost thresholds
costThresholds: {
    warning: 0.01,    // Warn at $0.01
    critical: 0.10    // Alert at $0.10
}
```

### 3. **Production Setup**
```typescript
// Production configuration
{
    global: {
        samplingRate: 0.1,        // 10% sampling
        bufferSize: 10000,        // Larger buffer
        flushInterval: 60000      // 1 minute flush
    },
    advanced: {
        retentionDays: 90,        // 90-day retention
        compressionEnabled: true,  // Enable compression
        enablePredictiveAnalysis: true
    }
}
```

## 📚 Examples

See the `examples/08-performance-monitoring/` directory for complete examples:

- `01-basic-performance-monitoring.ts` - Basic usage and setup
- `02-advanced-configuration.ts` - Advanced configuration options
- `03-custom-connectors.ts` - Custom performance connectors
- `04-real-time-monitoring.ts` - Real-time event streaming
- `05-cost-optimization.ts` - LLM cost tracking and optimization

## 🤝 Contributing

The performance monitoring system is extensible and welcomes contributions:

1. **Custom Connectors**: Implement cloud storage connectors
2. **Analysis Algorithms**: Add new performance analysis methods
3. **Export Formats**: Support additional export formats
4. **Visualization**: Create performance visualization tools

## 📞 Support

For questions and support:

- 📖 **Documentation**: Check the SmythOS documentation
- 💬 **Community**: Join the SmythOS Discord
- 🐛 **Issues**: Report issues on GitHub
- 📧 **Enterprise**: Contact enterprise support

---

🚀 **Ready to optimize your AI agents?** Start monitoring today with zero configuration required!
