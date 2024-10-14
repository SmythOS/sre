export function JSON2ADL(jsonString) {
    const agentData = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    let adl = '';

    // Create agent
    adl += 'CREATE AGENT\n';
    adl += `NAME = "${agentData.name || agentData?.templateInfo?.name || ''}"\n`;
    adl += `DESCRIPTION = "${agentData.description || ''}"\n`;
    adl += `BEHAVIOR = "${agentData.behavior || ''}"\n\n`;

    // Components
    agentData.components.forEach((component) => {
        adl += `INSERT COMPONENT ${component.name} ID=${component.id}\n`;
        adl += `TITLE = "${component.title || ''}"\n`;
        adl += `DESCRIPTION = "${component.description || ''}"\n`;
        // Replace POS with separate LEFT and TOP
        adl += `LEFT = ${parseInt(component.left)}\n`;
        adl += `TOP = ${parseInt(component.top)}\n`;

        // Settings
        if (Object.keys(component.data).length > 0) {
            const settings = JSON.parse(JSON.stringify(component.data));
            //strip empty values
            const strippedSettings = Object.fromEntries(
                Object.entries(settings).filter(([key, value]) => value !== '' && value !== null && value !== undefined)
            );
            adl += `SETTINGS = ${JSON.stringify(strippedSettings)}\n`;
        }

        // Inputs
        if (component.inputs.length > 0) {
            const inputs = component.inputs
                .map((input) => {
                    let name = input.name;
                    if (input.optional) name += '?';
                    if (input.default) name += '*';
                    return `${name}:${input.type}`;
                })
                .join(', ');
            adl += `INPUTS = [${inputs}]\n`;
        }

        // Outputs
        if (component.outputs.length > 0) {
            const outputs = component.outputs
                .map((output) => {
                    let name = output.name;
                    if (output.optional) name += '?';
                    if (output.default) name += '*';
                    return `${name}:${output.type}`;
                })
                .join(', ');
            adl += `OUTPUTS = [${outputs}]\n`;
        }

        adl += 'COMMIT\n\n';
    });

    // Connections
    agentData.connections.forEach((connection) => {
        const sourceComponent = agentData.components.find((c) => c.id === connection.sourceId);
        const targetComponent = agentData.components.find((c) => c.id === connection.targetId);

        if (sourceComponent && targetComponent) {
            const sourceOutput = sourceComponent.outputs[connection.sourceIndex].name;
            const targetInput = targetComponent.inputs[connection.targetIndex].name;
            adl += `CONNECT ${connection.sourceId}:${sourceOutput} TO ${connection.targetId}:${targetInput}\n`;
        }
    });

    return adl.trim();
}
