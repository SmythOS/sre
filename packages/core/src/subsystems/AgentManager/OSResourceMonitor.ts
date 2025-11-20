import os from 'os';
import process from 'process';

// Store previous CPU times for delta calculation
let previousCpuTimes: { user: number; nice: number; sys: number; idle: number; irq: number } | null = null;

const monitorData: any = {
    mem: getMemoryUsage(),
    cpu: getCpuUsage(),
    //processMemory: getProcessMemoryUsage(),
    //processCpu: getProcessCpuUsage(),
};

const itv = setInterval(() => {
    monitorData.mem = getMemoryUsage();
    monitorData.cpu = getCpuUsage();
    //monitorData.processMemory = getProcessMemoryUsage();
    //monitorData.processCpu = getProcessCpuUsage();
}, 5000);

itv.unref();

const OSResourceMonitor: any = {
    get mem() {
        return monitorData.mem;
    },
    get cpu() {
        return monitorData.cpu;
    },
};

export { OSResourceMonitor };

function getCpuUsage() {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;

    // Sum up times across all CPU cores
    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }

    const currentTimes = { user, nice, sys, idle, irq };

    // If this is the first measurement, store it and return zero load
    if (!previousCpuTimes) {
        previousCpuTimes = currentTimes;
        return {
            user: 0,
            sys: 0,
            idle: 100,
            load: 0,
        };
    }

    // Calculate deltas since last measurement
    const userDelta = currentTimes.user - previousCpuTimes.user;
    const niceDelta = currentTimes.nice - previousCpuTimes.nice;
    const sysDelta = currentTimes.sys - previousCpuTimes.sys;
    const idleDelta = currentTimes.idle - previousCpuTimes.idle;
    const irqDelta = currentTimes.irq - previousCpuTimes.irq;

    const totalDelta = userDelta + niceDelta + sysDelta + idleDelta + irqDelta;

    // Store current times for next calculation
    previousCpuTimes = currentTimes;

    // Avoid division by zero
    if (totalDelta === 0) {
        return {
            user: 0,
            sys: 0,
            idle: 100,
            load: 0,
        };
    }

    // Calculate percentages based on delta (actual usage since last check)
    const userPercent = (userDelta / totalDelta) * 100;
    const sysPercent = (sysDelta / totalDelta) * 100;
    const idlePercent = (idleDelta / totalDelta) * 100;
    const loadPercent = 100 - idlePercent;

    return {
        user: Math.round(userPercent * 100) / 100, // Round to 2 decimals
        sys: Math.round(sysPercent * 100) / 100,
        idle: Math.round(idlePercent * 100) / 100,
        load: Math.round(loadPercent * 100) / 100,
    };
}

function getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
        totalMemory: (totalMemory / 1024 ** 3).toFixed(2) + ' GB',
        freeMemory: (freeMemory / 1024 ** 3).toFixed(2) + ' GB',
        usedMemory: (usedMemory / 1024 ** 3).toFixed(2) + ' GB',
        memoryUsagePercentage: ((usedMemory / totalMemory) * 100).toFixed(2),
    };
}

function getProcessMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return {
        total: memoryUsage.rss,
        heapTotal: (memoryUsage.heapTotal / 1024 ** 2).toFixed(2) + ' MB',
        heapUsed: (memoryUsage.heapUsed / 1024 ** 2).toFixed(2) + ' MB',
        external: (memoryUsage.external / 1024 ** 2).toFixed(2) + ' MB',
    };
}

function getProcessCpuUsage() {
    const cpuUsage = process.cpuUsage();
    return {
        user: cpuUsage.user,
        system: cpuUsage.system,
    };
}

function logSystemUsage() {
    OSResourceMonitor.mem = getMemoryUsage();
    OSResourceMonitor.cpu = getCpuUsage();
    //OSResourceMonitor.processMemory = getProcessMemoryUsage();
    //OSResourceMonitor.processCpu = getProcessCpuUsage();
}

//setInterval(logSystemUsage, 5000); // update every 5 seconds
