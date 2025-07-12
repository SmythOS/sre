import { GitInstance } from './GitInstance.class';

export class Git {
    static instance(settings?: any) {
        return new GitInstance(settings);
    }
}
