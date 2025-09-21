export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
    code: string;
    message: string;
    hint?: string;
    severity: ValidationSeverity;
    componentIds: string[];
    cyclePath?: string[];
}

export interface ValidationResult {
    isValid: boolean;
    issues: ValidationIssue[];
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    topologicalOrder?: string[];
}

export interface ValidatorOptions {
    cycleWarningAllowlistNames?: string[];
}

// Minimal shapes expected by the validator. These mirror the agent graph structure used at runtime.
export interface GraphComponentInputDef {
    name: string;
    optional?: boolean;
    default?: boolean;
}

export interface GraphComponentOutputDef {
    name: string;
}

export interface GraphComponent {
    id: string;
    name: string;
    inputs?: GraphComponentInputDef[];
    outputs?: GraphComponentOutputDef[];
}

export interface GraphConnection {
    sourceId: string;
    targetId: string;
    sourceIndex: number | string;
    targetIndex: number | string;
}

export interface AgentGraphLike {
    components: GraphComponent[];
    connections: GraphConnection[];
}


