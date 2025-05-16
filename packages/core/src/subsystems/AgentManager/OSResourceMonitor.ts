import os from 'os';
import process from 'process';

const OSResourceMonitor: any = {
    mem: getMemoryUsage(),
    //processMemory: getProcessMemoryUsage(),
    cpu: getCpuUsage(),
    //processCpu: getProcessCpuUsage(),
};
export { OSResourceMonitor };

function getCpuUsage() {
    const cpus = os.cpus();
    let user = 0;
    let nice = 0;
    let sys = 0;
    let idle = 0;
    let irq = 0;
    let total = 0;

    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }

    total = user + nice + sys + idle + irq;

    return {
        user: (user / total) * 100,
        sys: (sys / total) * 100,
        idle: (idle / total) * 100,
        load: 100 - (idle / total) * 100,
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
