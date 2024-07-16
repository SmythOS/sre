export function isDigits(str: string): boolean {
    if (typeof str === 'number') return true;

    if (typeof str !== 'string') return false;

    const numRegex = /^-?\d+(\.\d+)?$/;
    return numRegex.test(str.trim());
}

export function isSafeNumber(str: string): boolean {
    const num = parseFloat(str);
    return !isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER && num.toString() === str.trim();
}
