/**
 * Schedule - Fluent API for building schedule definitions
 *
 * Supports interval-based scheduling and cron expressions.
 * Serializable to JSON for persistence.
 *
 * @example
 * ```typescript
 * // Interval-based scheduling
 * const schedule = Schedule.every('10m');
 * const schedule2 = Schedule.every('30s').starts(new Date('2025-01-01')).ends(new Date('2025-12-31'));
 *
 * // Cron-based scheduling
 * const schedule3 = Schedule.cron('0 0 * * *'); // Daily at midnight
 *
 * // Serialization
 * const json = schedule.toJSON();
 * const restored = Schedule.fromJSON(json);
 * ```
 */

export interface IScheduleData {
    interval?: string; // e.g., "10m", "30s", "2h"
    startDate?: string; // ISO 8601
    endDate?: string; // ISO 8601
    cron?: string; // Cron expression
}

export class Schedule {
    private data: IScheduleData = {};

    private constructor(data?: IScheduleData) {
        if (data) {
            this.data = { ...data };
        }
    }

    /**
     * Create a schedule with an interval
     * @param interval - Time interval (e.g., "10m", "30s", "2h", "1d")
     */
    public static every(interval: string): Schedule {
        const schedule = new Schedule();
        schedule.data.interval = interval;
        return schedule;
    }

    /**
     * Create a schedule with a cron expression
     * @param cronExpression - Cron expression (e.g., "0 0 * * *")
     */
    public static cron(cronExpression: string): Schedule {
        const schedule = new Schedule();
        schedule.data.cron = cronExpression;
        return schedule;
    }

    /**
     * Set the start date for the schedule
     * @param date - Start date
     */
    public starts(date: Date): Schedule {
        this.data.startDate = date.toISOString();
        return this;
    }

    /**
     * Set the end date for the schedule
     * @param date - End date
     */
    public ends(date: Date): Schedule {
        this.data.endDate = date.toISOString();
        return this;
    }

    /**
     * Convert schedule to JSON representation
     */
    public toJSON(): IScheduleData {
        return { ...this.data };
    }

    /**
     * Create a Schedule instance from JSON data
     * @param json - Schedule data
     */
    public static fromJSON(json: IScheduleData): Schedule {
        return new Schedule(json);
    }

    /**
     * Get the schedule data
     */
    public getData(): IScheduleData {
        return { ...this.data };
    }

    /**
     * Validate the schedule configuration
     */
    public validate(): { valid: boolean; error?: string } {
        // Must have either interval or cron
        if (!this.data.interval && !this.data.cron) {
            return { valid: false, error: 'Schedule must have either interval or cron expression' };
        }

        // Cannot have both
        if (this.data.interval && this.data.cron) {
            return { valid: false, error: 'Schedule cannot have both interval and cron expression' };
        }

        // Validate interval format
        if (this.data.interval) {
            const intervalRegex = /^(\d+)(s|m|h|d|w)$/;
            if (!intervalRegex.test(this.data.interval)) {
                return { valid: false, error: 'Invalid interval format. Use format like "10m", "30s", "2h"' };
            }
        }

        // Validate date range
        if (this.data.startDate && this.data.endDate) {
            const start = new Date(this.data.startDate);
            const end = new Date(this.data.endDate);
            if (start >= end) {
                return { valid: false, error: 'Start date must be before end date' };
            }
        }

        return { valid: true };
    }

    /**
     * Parse interval string to milliseconds
     * @param interval - Interval string (e.g., "10m")
     */
    public static parseInterval(interval: string): number {
        const match = interval.match(/^(\d+)(s|m|h|d|w)$/);
        if (!match) {
            throw new Error(`Invalid interval format: ${interval}`);
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        const multipliers: Record<string, number> = {
            s: 1000, // seconds
            m: 60 * 1000, // minutes
            h: 60 * 60 * 1000, // hours
            d: 24 * 60 * 60 * 1000, // days
            w: 7 * 24 * 60 * 60 * 1000, // weeks
        };

        return value * multipliers[unit];
    }

    /**
     * Check if schedule should run at the given time
     * @param now - Current time
     */
    public shouldRun(now: Date = new Date()): boolean {
        // Check date range
        if (this.data.startDate && now < new Date(this.data.startDate)) {
            return false;
        }
        if (this.data.endDate && now > new Date(this.data.endDate)) {
            return false;
        }
        return true;
    }

    /**
     * Calculate next run time based on last run
     * @param lastRun - Last execution time
     */
    public calculateNextRun(lastRun?: Date): Date | null {
        const now = new Date();

        // If schedule has ended, no next run
        if (this.data.endDate && now > new Date(this.data.endDate)) {
            return null;
        }

        // For interval-based scheduling
        if (this.data.interval) {
            const intervalMs = Schedule.parseInterval(this.data.interval);
            const nextRun = lastRun ? new Date(lastRun.getTime() + intervalMs) : now;

            // Ensure next run is not before start date
            if (this.data.startDate) {
                const startDate = new Date(this.data.startDate);
                return nextRun < startDate ? startDate : nextRun;
            }

            return nextRun;
        }

        // For cron-based scheduling, return null (will be handled by node-cron)
        return null;
    }
}
