interface RangeValidationArgs {
    min?: number;
    max?: number;
}

/**
 * Custom validation function to check if a string contains only specified characters.
 * @param {string} value - The string to validate.
 * @param {object} helpers - Joi's helper object for custom validations.
 * @returns {string} - The validated string.
 */
export function validateCharacterSet(value, helpers) {
    // // Regular expression for allowed characters
    // const allowedCharsPattern = /^[a-zA-Z0-9\-_.]+$/;

    // if (!allowedCharsPattern.test(value)) {
    //   // If validation fails, return a custom error message
    //   const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];
    //   throw new Error(`The value for '${fieldName}' contains invalid characters`);

    // }

    // return value; // Return the value if it is valid

    if (value === '') return true;
    // Check for {{sometext}} structures and split the string
    const parts = value.split(/(\{\{[^}]+\}\})/).filter(Boolean);

    for (const part of parts) {
        if (part.startsWith('{{') && part.endsWith('}}')) {
            // Check if the content inside {{...}} is not empty
            const innerContent = part.slice(2, -2).trim();
            if (innerContent === '') {
                return false; // Empty content inside {{...}}
            }
        } else {
            // Check for valid characters outside of {{...}}
            if (!/^[a-zA-Z0-9\-_.]+$/.test(part)) {
                return false; // Invalid characters found
            }
        }
    }

    return true;
}

/**
 * Validates whether a given string value can be converted to an integer that falls within a specified range.
 * This function is designed to be used as a custom validator in Joi schemas.
 *
 * @param {RangeValidationArgs} args - An object containing optional 'min' and 'max' properties to define the range.
 * @returns {Function} A function that takes a string value and a Joi helper object, and performs the validation.
 *
 * The validation function first converts the string value to a number. It then checks if the number is within the
 * specified range (if provided). If the value is not a number or falls outside the range, it throws an error with a
 * descriptive message.
 *
 * The error message includes the field name for clarity, using the label from the Joi schema if available.
 */
export const validateInteger = (args: RangeValidationArgs) => {
    return (value: string, helpers: any) => {
        const numValue = Number(value);
        const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];

        // Check if the value is a number
        if (isNaN(numValue)) {
            throw new Error(`The value for '${fieldName}' must be a number`);
        }

        // Range validations
        if (args.min !== undefined && args.max !== undefined) {
            if (numValue < args.min || numValue > args.max) {
                throw new Error(`The value for '${fieldName}' must be from ${args.min} to ${args.max}`);
            }
        } else if (args.min !== undefined) {
            if (numValue < args.min) {
                throw new Error(`The value for '${fieldName}' must be greater or equal to ${args.min}`);
            }
        } else if (args.max !== undefined) {
            if (numValue > args.max) {
                throw new Error(`The value for '${fieldName}' must be less or equal to ${args.max}`);
            }
        }

        return value; // Value is valid
    };
};
